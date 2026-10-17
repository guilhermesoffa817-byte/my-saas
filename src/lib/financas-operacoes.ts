/**
 * Os lançamentos das Finanças, do jeito que a tela grava e o teste confere.
 *
 * A ação da tela chama estas funções com o Prisma do servidor; os testes, com
 * o banco de teste. Toda consulta filtra pelo estúdio, e toda gravação passa
 * pela trava do mês fechado na mesma transação.
 */
import type { PrismaClient } from "@/generated/prisma";
import { conferirMesesAbertos, mesDoInstante } from "@/lib/fechamento/trava";

type Banco = PrismaClient;

export type NovoLancamento = {
  tipo: "entrada" | "saida";
  descricao: string;
  categoria: string | null;
  valorCentavos: number;
  data: Date;
};

export async function registrarLancamento(
  db: Banco,
  usuarioId: string,
  entrada: NovoLancamento,
): Promise<{ erro: string } | { id: string }> {
  return db.$transaction(async (tx) => {
    const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(entrada.data)]);
    if (fechado) return { erro: fechado.erro };

    return tx.lancamento.create({
      data: { usuarioId, ...entrada },
      select: { id: true },
    });
  });
}

export type ResultadoDaExclusao =
  | { resultado: "apagado" | "nao_encontrado" | "da_equipe" }
  | { erro: string };

/**
 * Apaga um lançamento digitado na tela. Saída que veio da Equipe sai pela
 * Equipe, que apaga o pagamento e a saída juntos.
 */
export async function apagarLancamento(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<ResultadoDaExclusao> {
  return db.$transaction(async (tx) => {
    const lancamento = await tx.lancamento.findFirst({
      where: { id, usuarioId },
      select: { id: true, data: true, pagamentoDeColaborador: { select: { id: true } } },
    });
    if (!lancamento) return { resultado: "nao_encontrado" as const };
    if (lancamento.pagamentoDeColaborador) return { resultado: "da_equipe" as const };

    const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(lancamento.data)]);
    if (fechado) return { erro: fechado.erro };

    await tx.lancamento.deleteMany({ where: { id: lancamento.id, usuarioId } });
    return { resultado: "apagado" as const };
  });
}
