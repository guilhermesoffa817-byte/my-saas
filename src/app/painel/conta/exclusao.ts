/**
 * Excluir a conta de um estúdio, com tudo o que é dele.
 *
 * Fica fora do arquivo de ações para que o teste de banco percorra a mesma
 * exclusão, sem cookie nem requisição. Recebe o cliente do Prisma por parâmetro.
 */

import type { PrismaClient } from "@/generated/prisma";
import { chaveDoEmail, chaveDoPainel } from "@/lib/limite";

export type ResultadoDaExclusao =
  | { excluida: true; caminhos: string[] }
  | { excluida: false };

/**
 * Apaga a conta e devolve os caminhos dos arquivos enviados, que moram fora do
 * banco e precisam ser apagados à parte.
 *
 * A conta da administração nunca sai por aqui, e a regra está na própria
 * consulta, não só na tela: é ela que confere os Pix das assinaturas e gera os
 * links de senha nova. Sem ela, nenhum estúdio voltaria a entrar depois de pagar.
 */
export async function excluirEstudio(
  db: Pick<PrismaClient, "$transaction">,
  usuarioId: string,
): Promise<ResultadoDaExclusao> {
  return db.$transaction(async (tx) => {
    const conta = await tx.usuario.findFirst({
      where: { id: usuarioId, papel: { not: "admin" } },
      select: { email: true },
    });
    if (!conta) return { excluida: false };

    const documentos = await tx.documento.findMany({
      where: { usuarioId },
      select: { caminho: true },
    });

    // Os horários saem primeiro. O serviço não pode sumir enquanto houver
    // horário apontando para ele, e a ordem em que o banco apaga em cascata
    // não é garantida. Assim a exclusão nunca trava no meio.
    await tx.agendamento.deleteMany({ where: { usuarioId } });

    // O resto vai junto com a conta: clientes, cobranças, lançamentos,
    // vencimentos, documentos, pagamentos e pedidos de senha.
    await tx.usuario.delete({ where: { id: usuarioId } });

    // As tentativas de senha não apontam para a conta, só para o resumo.
    await tx.tentativaDeEntrada.deleteMany({
      where: { chave: { in: [chaveDoEmail(conta.email), chaveDoPainel(usuarioId)] } },
    });

    return {
      excluida: true,
      caminhos: documentos.map((documento) => documento.caminho).filter(Boolean),
    };
  });
}
