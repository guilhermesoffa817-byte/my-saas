/**
 * Pagar um vencimento, do jeito que a tela faz e o teste confere.
 *
 * A ação da tela chama esta função com o Prisma do servidor; o teste chama a
 * mesma função com o banco de teste. Toda consulta filtra pelo estúdio.
 */
import type { PrismaClient } from "@/generated/prisma";
import { instanteDoDiaPuro } from "@/lib/formato";
import {
  MesFechadoErro,
  conferirMesesAbertos,
  exigirMesesAbertos,
  mesDoDiaPuro,
  mesDoInstante,
} from "@/lib/fechamento/trava";

type Banco = PrismaClient;

export type ResultadoDoPagamento =
  | { erro: string }
  | { resultado: "pago" | "ja_pago"; tipo: string };

export async function pagarVencimento(
  db: Banco,
  usuarioId: string,
  id: string,
  pagoEm: Date,
): Promise<ResultadoDoPagamento> {
  const vencimento = await db.vencimento.findFirst({
    where: { id, usuarioId },
    select: { id: true, pago: true, tipo: true, descricao: true, categoria: true, valorCentavos: true },
  });
  if (!vencimento) return { erro: "Não encontramos esse vencimento." };
  if (vencimento.pago) return { resultado: "ja_pago", tipo: vencimento.tipo };

  try {
    await pagarDentroDaTransacao(db, usuarioId, vencimento, pagoEm);
  } catch (erro) {
    if (erro instanceof MesFechadoErro) return { erro: erro.message };
    throw erro;
  }

  return { resultado: "pago", tipo: vencimento.tipo };
}

async function pagarDentroDaTransacao(
  db: Banco,
  usuarioId: string,
  vencimento: {
    id: string;
    tipo: string;
    descricao: string;
    categoria: string | null;
    valorCentavos: number | null;
  },
  pagoEm: Date,
) {
  await db.$transaction(async (tx) => {
    // Só a conta com valor vira dinheiro; prazo de contrato não passa pela trava.
    if (vencimento.tipo === "conta" && vencimento.valorCentavos) {
      await exigirMesesAbertos(tx, usuarioId, [mesDoDiaPuro(pagoEm)]);
    }

    /*
      A condição `pago: false` dentro do próprio UPDATE é o que impede a saída
      de ser lançada duas vezes. O segundo toque muda zero linhas e para aqui.
    */
    const mudados = await tx.vencimento.updateMany({
      where: { id: vencimento.id, usuarioId, pago: false },
      data: { pago: true, pagoEm },
    });
    if (mudados.count === 0) return;

    // Prazo de contrato não é dinheiro: marcar como resolvido não lança nada.
    if (vencimento.tipo !== "conta" || !vencimento.valorCentavos) return;

    const lancamento = await tx.lancamento.create({
      data: {
        usuarioId,
        tipo: "saida",
        descricao: vencimento.descricao,
        categoria: vencimento.categoria ?? "Conta",
        valorCentavos: vencimento.valorCentavos,
        /*
          O vencimento guarda o dia puro (meia-noite em UTC); o lançamento é
          um instante mostrado no fuso do estúdio. Gravar o dia puro direto
          fazia a conta paga no dia 10 aparecer nas Finanças no dia 9.
        */
        data: instanteDoDiaPuro(pagoEm),
      },
      select: { id: true },
    });

    await tx.vencimento.update({
      where: { id: vencimento.id },
      data: { lancamentoId: lancamento.id },
    });
  });
}

/**
 * Apaga um vencimento e, se ele já tinha sido pago, a saída que o pagamento
 * criou. Com a saída num mês fechado, nada sai.
 */
export async function apagarVencimento(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<{ erro: string } | { resultado: "apagado" | "nao_encontrado" }> {
  return db.$transaction(async (tx) => {
    const vencimento = await tx.vencimento.findFirst({
      where: { id, usuarioId },
      select: { id: true, lancamentoId: true },
    });
    if (!vencimento) return { resultado: "nao_encontrado" as const };

    if (vencimento.lancamentoId) {
      const lancamento = await tx.lancamento.findFirst({
        where: { id: vencimento.lancamentoId, usuarioId },
        select: { data: true },
      });
      if (lancamento) {
        const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(lancamento.data)]);
        if (fechado) return { erro: fechado.erro };
      }
      // O lançamento sai junto: o dinheiro só existia por causa deste vencimento.
      await tx.lancamento.deleteMany({ where: { id: vencimento.lancamentoId, usuarioId } });
    }
    await tx.vencimento.deleteMany({ where: { id: vencimento.id, usuarioId } });
    return { resultado: "apagado" as const };
  });
}
