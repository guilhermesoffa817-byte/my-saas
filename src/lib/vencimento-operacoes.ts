/**
 * Criar, pagar e apagar vencimentos, do jeito que a tela faz e o teste confere.
 *
 * A ação da tela chama estas funções com o Prisma do servidor; o teste chama
 * as mesmas funções com o banco de teste. Toda consulta filtra pelo estúdio.
 *
 * Conta com valor é dinheiro do mês: o relatório lista as "Contas a pagar do
 * mês" pela data de vencimento. Por isso criar, gerar pela repetição ou apagar
 * uma conta num mês fechado passa pela trava, como pagar já passava. Prazo de
 * contrato e conta sem valor não entram no relatório e seguem livres.
 */
import type { PrismaClient } from "@/generated/prisma";
import { instanteDoDiaPuro } from "@/lib/formato";
import { ocorrenciasQueFaltam } from "@/lib/vencimento";
import {
  MesFechadoErro,
  conferirMesesAbertos,
  exigirMesesAbertos,
  mesDoDiaPuro,
  mesDoInstante,
  mesesFechados,
  travarFechamentoDoEstudio,
} from "@/lib/fechamento/trava";

type Banco = PrismaClient;

/** Se o vencimento entra no relatório do mês: conta, e com valor. */
function ehDinheiroDoMes(vencimento: { tipo: string; valorCentavos: number | null }) {
  return vencimento.tipo === "conta" && Boolean(vencimento.valorCentavos);
}

export type NovoVencimento = {
  tipo: string;
  descricao: string;
  categoria: string | null;
  valorCentavos: number | null;
  /** Dia de calendário (meia-noite UTC). */
  data: Date;
};

/** Guarda um vencimento avulso. Conta com valor num mês fechado não entra. */
export async function criarVencimento(
  db: Banco,
  usuarioId: string,
  entrada: NovoVencimento,
): Promise<{ erro: string } | { id: string }> {
  return db.$transaction(async (tx) => {
    if (ehDinheiroDoMes(entrada)) {
      const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoDiaPuro(entrada.data)]);
      if (fechado) return { erro: fechado.erro };
    }
    return tx.vencimento.create({ data: { usuarioId, ...entrada }, select: { id: true } });
  });
}

/**
 * Completa as ocorrências que faltam de uma repetição.
 *
 * É chamada quando a tela abre e quando o combinado é criado. Não existe tarefa
 * agendada: a cada visita o Bossa compara o que deveria existir com o que
 * existe e grava a diferença. O par repetição e data é único no banco, então
 * duas visitas ao mesmo tempo não criam a mesma data duas vezes.
 *
 * A data que cai num mês fechado fica para depois: quando o mês for reaberto,
 * a próxima visita a completa. Devolve quantas ocorrências foram criadas.
 */
export async function completarRepeticao(
  db: Banco,
  usuarioId: string,
  repeticaoId: string,
  hoje: Date,
): Promise<number> {
  const repeticao = await db.repeticaoDeVencimento.findFirst({
    where: { id: repeticaoId, usuarioId, ativa: true },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      categoria: true,
      valorCentavos: true,
      primeira: true,
      ate: true,
      vencimentos: { select: { data: true } },
    },
  });
  if (!repeticao) return 0;

  const faltam = ocorrenciasQueFaltam({
    primeira: repeticao.primeira,
    ate: repeticao.ate,
    jaGravadas: repeticao.vencimentos.map((item) => item.data),
    hoje,
  });
  if (faltam.length === 0) return 0;

  return db.$transaction(async (tx) => {
    let datas = faltam;
    if (ehDinheiroDoMes(repeticao)) {
      await travarFechamentoDoEstudio(tx, usuarioId);
      const fechados = await mesesFechados(tx, usuarioId);
      datas = faltam.filter((data) => !fechados.has(mesDoDiaPuro(data)));
    }
    if (datas.length === 0) return 0;

    const criadas = await tx.vencimento.createMany({
      data: datas.map((data) => ({
        usuarioId,
        repeticaoId: repeticao.id,
        tipo: repeticao.tipo,
        descricao: repeticao.descricao,
        categoria: repeticao.categoria,
        valorCentavos: repeticao.valorCentavos,
        data,
      })),
      skipDuplicates: true,
    });
    return criadas.count;
  });
}

/**
 * Encerra um combinado. As datas futuras que ninguém pagou somem; o que já foi
 * pago fica no histórico, porque aquilo aconteceu de verdade. A data futura que
 * cai num mês fechado (o mês atual, se a dona já o fechou) também fica.
 */
export async function encerrarRepeticao(db: Banco, usuarioId: string, id: string, hoje: Date) {
  return db.$transaction(async (tx) => {
    const repeticao = await tx.repeticaoDeVencimento.findFirst({
      where: { id, usuarioId, ativa: true },
      select: { id: true, tipo: true, valorCentavos: true },
    });
    if (!repeticao) return false;

    await tx.repeticaoDeVencimento.updateMany({
      where: { id: repeticao.id, usuarioId, ativa: true },
      data: { ativa: false },
    });

    const futuras = await tx.vencimento.findMany({
      where: { repeticaoId: repeticao.id, usuarioId, pago: false, data: { gt: hoje } },
      select: { id: true, data: true },
    });
    let saem = futuras;
    if (ehDinheiroDoMes(repeticao) && futuras.length > 0) {
      await travarFechamentoDoEstudio(tx, usuarioId);
      const fechados = await mesesFechados(tx, usuarioId);
      saem = futuras.filter((item) => !fechados.has(mesDoDiaPuro(item.data)));
    }
    if (saem.length > 0) {
      await tx.vencimento.deleteMany({
        where: { id: { in: saem.map((item) => item.id) }, usuarioId },
      });
    }
    return true;
  });
}

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
 * criou. Com a conta ou a saída num mês fechado, nada sai.
 */
export async function apagarVencimento(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<{ erro: string } | { resultado: "apagado" | "nao_encontrado" }> {
  return db.$transaction(async (tx) => {
    const vencimento = await tx.vencimento.findFirst({
      where: { id, usuarioId },
      select: { id: true, lancamentoId: true, tipo: true, valorCentavos: true, data: true },
    });
    if (!vencimento) return { resultado: "nao_encontrado" as const };

    const lancamento = vencimento.lancamentoId
      ? await tx.lancamento.findFirst({
          where: { id: vencimento.lancamentoId, usuarioId },
          select: { data: true },
        })
      : null;

    // O mês da conta (lista de contas do relatório) e o mês da saída do pagamento.
    const fechado = await conferirMesesAbertos(tx, usuarioId, [
      ehDinheiroDoMes(vencimento) ? mesDoDiaPuro(vencimento.data) : null,
      lancamento ? mesDoInstante(lancamento.data) : null,
    ]);
    if (fechado) return { erro: fechado.erro };

    if (vencimento.lancamentoId) {
      // O lançamento sai junto: o dinheiro só existia por causa deste vencimento.
      await tx.lancamento.deleteMany({ where: { id: vencimento.lancamentoId, usuarioId } });
    }
    await tx.vencimento.deleteMany({ where: { id: vencimento.id, usuarioId } });
    return { resultado: "apagado" as const };
  });
}
