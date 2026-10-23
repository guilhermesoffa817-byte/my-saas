/**
 * Avisar, confirmar e recusar o Pix da assinatura, do jeito que a tela faz e o
 * teste confere.
 *
 * A ação da tela chama estas funções com o Prisma do servidor; o teste chama
 * as mesmas funções com o banco de teste. A regra de troca de plano em si
 * (quantos dias, qual plano) é pura e mora em lib/assinatura.ts.
 */
import type { PrismaClient } from "@/generated/prisma";
import {
  aplicarPagamento,
  planoPorCodigo,
  type CodigoPlano,
  type ResultadoDoPagamento,
} from "@/lib/assinatura";
import { ehContaDeExemplo } from "@/lib/demonstracao/conta";
import { competenciaAtual } from "@/lib/formato";

type Banco = PrismaClient;

export type AvisoDePix =
  /** Não havia aviso esperando: um novo foi gravado. */
  | { tipo: "novo"; plano: CodigoPlano }
  /** Já havia um aviso do mesmo plano: só o recado (se veio) foi atualizado. */
  | { tipo: "mesmo"; plano: CodigoPlano }
  /** Havia um aviso de outro plano: ele passou a ser deste plano, com o valor deste plano. */
  | { tipo: "trocado"; plano: CodigoPlano; antes: CodigoPlano };

function ehRepetido(erro: unknown) {
  return typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "P2002";
}

/**
 * Grava o aviso de Pix da conta. Só existe um aviso esperando por conta (o
 * banco garante, com um índice único parcial): se já houver um, ele é
 * ATUALIZADO com o plano e o valor escolhidos agora, e com o recado novo.
 *
 * Duas abas avisando no mesmo instante: as duas tentam criar, o banco aceita
 * uma e recusa a outra (P2002), e a recusada volta e atualiza o aviso que a
 * primeira acabou de gravar. Nunca ficam dois.
 */
export async function avisarPix(
  db: Banco,
  {
    usuarioId,
    plano: codigo,
    observacao,
    agora = new Date(),
  }: { usuarioId: string; plano: unknown; observacao: string | null; agora?: Date },
): Promise<AvisoDePix> {
  const plano = planoPorCodigo(codigo);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const pendente = await db.pagamento.findFirst({
      where: { usuarioId, status: "aguardando" },
      select: { id: true, plano: true },
    });

    if (pendente) {
      // A condição no status segura o caso de o admin conferir no meio do caminho.
      const { count } = await db.pagamento.updateMany({
        where: { id: pendente.id, status: "aguardando" },
        data: {
          plano: plano.codigo,
          valorCentavos: plano.valorCentavos,
          ...(observacao ? { observacao } : {}),
        },
      });
      if (count === 1) {
        const antes = planoPorCodigo(pendente.plano).codigo;
        return antes === plano.codigo
          ? { tipo: "mesmo", plano: plano.codigo }
          : { tipo: "trocado", plano: plano.codigo, antes };
      }
      continue;
    }

    try {
      await db.pagamento.create({
        data: {
          usuarioId,
          valorCentavos: plano.valorCentavos,
          plano: plano.codigo,
          competencia: competenciaAtual(agora),
          observacao,
        },
      });
      return { tipo: "novo", plano: plano.codigo };
    } catch (erro) {
      // Outra aba gravou primeiro: a próxima volta atualiza o aviso dela.
      if (!ehRepetido(erro)) throw erro;
    }
  }

  throw new Error("Não consegui gravar o aviso do Pix depois de três tentativas.");
}

/**
 * Confirma um Pix avisado e aplica a regra de troca de plano. Devolve o que
 * passou a valer, ou null quando não havia o que confirmar (já conferido,
 * inexistente ou do estúdio de exemplo).
 *
 * Tudo numa transação: o pagamento é marcado com a condição "ainda está
 * esperando", então dois cliques (ou duas abas do admin) confirmam uma vez só,
 * e a assinatura da conta fica travada enquanto a conta é feita.
 */
export async function confirmarPix(
  db: Banco,
  pagamentoId: string,
  agora = new Date(),
  /**
   * O plano e o valor que o admin viu na tela. Se a cliente trocou o plano do
   * aviso depois disso, não confirma: o Pix pago pode ser de outro valor.
   */
  esperado?: { plano: string; valorCentavos: number },
): Promise<ResultadoDoPagamento | null> {
  return db.$transaction(async (tx) => {
    const pagamento = await tx.pagamento.findUnique({
      where: { id: pagamentoId },
      include: { usuario: { select: { id: true, papel: true } } },
    });
    if (!pagamento || pagamento.status !== "aguardando") return null;
    // O estúdio de exemplo não paga nem recebe plano: é só da demonstração.
    if (ehContaDeExemplo(pagamento.usuario)) return null;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`assinatura:${pagamento.usuarioId}`}, 0))`;

    const { count } = await tx.pagamento.updateMany({
      where: { id: pagamentoId, status: "aguardando", ...(esperado ?? {}) },
      data: { status: "confirmado", respondidoEm: agora },
    });
    if (count !== 1) return null;

    // Lido de novo depois de marcar: se a pessoa trocou o plano do aviso no
    // meio do caminho, vale o plano que ficou gravado, não o lido lá em cima.
    const { plano } = await tx.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
      select: { plano: true },
    });
    const assinatura = await tx.assinatura.findUnique({ where: { usuarioId: pagamento.usuarioId } });
    const resultado = aplicarPagamento(assinatura, plano, agora);

    /*
      Quem estava na demonstração passa a "ativa" aqui e, na próxima tela, vê os
      PRÓPRIOS dados (vazios no começo): o estúdio de exemplo nunca foi dele,
      então não há nada para misturar nem para limpar.
    */
    await tx.assinatura.upsert({
      where: { usuarioId: pagamento.usuarioId },
      create: {
        usuarioId: pagamento.usuarioId,
        status: "ativa",
        plano: resultado.plano,
        validaAte: resultado.validaAte,
      },
      update: { status: "ativa", plano: resultado.plano, validaAte: resultado.validaAte },
    });

    return resultado;
  });
}

/** Marca um Pix avisado como não localizado. Devolve se havia o que marcar. */
export async function recusarPix(db: Banco, pagamentoId: string, agora = new Date()) {
  const { count } = await db.pagamento.updateMany({
    where: { id: pagamentoId, status: "aguardando" },
    data: { status: "recusado", respondidoEm: agora },
  });
  return count === 1;
}
