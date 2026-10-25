/**
 * O que o relatório do mês lê do banco, num lugar só.
 *
 * A tela da dona, os downloads, a página do contador e o "Fechar o mês" chamam
 * estas funções; os testes chamam as mesmas, com o banco de teste. Toda
 * consulta filtra pelo estúdio (`usuarioId`).
 */
import type { Prisma } from "@/generated/prisma";
import {
  competenciaAtual,
  deDataPura,
  inicioDaCompetencia,
  paraDataPura,
  somarMeses,
} from "@/lib/formato";
import { mesValido } from "@/lib/custos/calculo";
import { precoDoAtendimento } from "@/lib/preco-do-atendimento";
import {
  lerResumoGuardado,
  montarRelatorio,
  type DadosDoMes,
  type RelatorioDoMes,
} from "./montar";

/** Serve para o Prisma do servidor e para a transação do fechamento. */
type Leitor = Prisma.TransactionClient;

/** O mês pedido no endereço, se for válido e não estiver no futuro; senão, o atual. */
export function mesDoPedido(pedido: string | undefined | null, agora: Date) {
  const atual = competenciaAtual(agora);
  if (!mesValido(pedido)) return atual;
  return pedido > atual ? atual : pedido;
}

/** Os últimos `quantos` meses, do atual para trás. */
export function ultimosMeses(agora: Date, quantos = 12) {
  const atual = competenciaAtual(agora);
  return Array.from({ length: quantos }, (_, posicao) => somarMeses(atual, -posicao));
}

export async function carregarDadosDoMes(
  db: Leitor,
  usuarioId: string,
  mes: string,
  agora: Date,
): Promise<DadosDoMes> {
  const virada = somarMeses(mes, 1);
  // Instantes para o que tem hora (lançamento, atendimento), no fuso do estúdio.
  const de = inicioDaCompetencia(mes);
  const ate = inicioDaCompetencia(virada);
  // Dias puros para o que é data de calendário (vencimento, pagamento).
  const primeiroDia = deDataPura(`${mes}-01`)!;
  const diaDaVirada = deDataPura(`${virada}-01`)!;

  const [usuario, atendimentos, lancamentos, cobrancas, contas] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: { impostoPercentual: true } }),
    db.agendamento.findMany({
      where: { usuarioId, status: "concluido", inicio: { gte: de, lt: ate } },
      select: { inicio: true, precoCentavos: true, servico: { select: { nome: true, precoCentavos: true } } },
    }),
    db.lancamento.findMany({
      where: { usuarioId, data: { gte: de, lt: ate } },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        categoria: true,
        valorCentavos: true,
        data: true,
        natureza: true,
        pagamentoDeColaborador: { select: { tipo: true } },
      },
    }),
    /*
      O que estava a receber na virada: criada antes dela e, se já foi paga,
      paga depois. Cancelada fica de fora: o Bossa não guarda quando cancelou.
    */
    db.cobranca.findMany({
      where: {
        usuarioId,
        criadoEm: { lt: ate },
        OR: [{ situacao: "aberta" }, { situacao: "paga", pagaEm: { gte: diaDaVirada } }],
      },
      select: { valorCentavos: true, vencimento: true, situacao: true, pagaEm: true, criadoEm: true },
    }),
    db.vencimento.findMany({
      where: {
        usuarioId,
        tipo: "conta",
        valorCentavos: { not: null },
        data: { gte: primeiroDia, lt: diaDaVirada },
      },
      select: {
        descricao: true,
        categoria: true,
        valorCentavos: true,
        data: true,
        pago: true,
        pagoEm: true,
      },
    }),
  ]);

  // As entradas que nasceram de cobrança avulsa, para não somar como manual.
  const entradas = lancamentos.filter((item) => item.tipo === "entrada").map((item) => item.id);
  const deCobranca =
    entradas.length === 0
      ? []
      : await db.cobranca.findMany({
          where: { usuarioId, lancamentoId: { in: entradas } },
          select: { lancamentoId: true },
        });
  const idsDeCobranca = new Set(deCobranca.map((item) => item.lancamentoId));

  return {
    mes,
    agora,
    impostoPercentual: usuario?.impostoPercentual ?? 0,
    atendimentos: atendimentos.map((item) => ({
      inicio: item.inicio,
      servico: item.servico.nome,
      precoCentavos: precoDoAtendimento(item),
    })),
    lancamentos: lancamentos.map((item) => ({
      data: item.data,
      tipo: item.tipo,
      descricao: item.descricao,
      categoria: item.categoria,
      valorCentavos: item.valorCentavos,
      natureza: item.natureza,
      deCobranca: idsDeCobranca.has(item.id),
      pagamentoDaEquipe: item.pagamentoDeColaborador?.tipo ?? null,
    })),
    cobrancas: cobrancas.map((item) => ({
      valorCentavos: item.valorCentavos,
      vencimento: paraDataPura(item.vencimento),
      situacao: item.situacao,
      pagaEm: item.pagaEm ? paraDataPura(item.pagaEm) : null,
      criadaEm: item.criadoEm,
    })),
    contas: contas.map((item) => ({
      descricao: item.descricao,
      categoria: item.categoria,
      valorCentavos: item.valorCentavos ?? 0,
      data: paraDataPura(item.data),
      pago: item.pago,
      pagoEm: item.pagoEm ? paraDataPura(item.pagoEm) : null,
    })),
  };
}

/** O relatório montado agora, com o que está no banco. */
export async function relatorioAoVivo(db: Leitor, usuarioId: string, mes: string, agora: Date) {
  return montarRelatorio(await carregarDadosDoMes(db, usuarioId, mes, agora));
}

export type SituacaoDoFechamento = {
  fechado: boolean;
  fechadoEm: Date;
  reabertoEm: Date | null;
} | null;

/**
 * O relatório que a tela mostra: o congelado, se o mês estiver fechado; senão,
 * o de agora. O mês fechado mostra o que foi fechado, mesmo que um preço de
 * serviço tenha mudado depois.
 */
export async function relatorioDoMes(
  db: Leitor,
  usuarioId: string,
  mes: string,
  agora: Date,
): Promise<{ relatorio: RelatorioDoMes; fechamento: SituacaoDoFechamento; congelado: boolean }> {
  const fechamento = await db.fechamentoDoMes.findUnique({
    where: { usuarioId_competencia: { usuarioId, competencia: mes } },
    select: { fechado: true, fechadoEm: true, reabertoEm: true, resumo: true },
  });

  const situacao: SituacaoDoFechamento = fechamento
    ? { fechado: fechamento.fechado, fechadoEm: fechamento.fechadoEm, reabertoEm: fechamento.reabertoEm }
    : null;

  if (fechamento?.fechado) {
    const guardado = lerResumoGuardado(fechamento.resumo);
    if (guardado) return { relatorio: guardado, fechamento: situacao, congelado: true };
  }

  return {
    relatorio: await relatorioAoVivo(db, usuarioId, mes, agora),
    fechamento: situacao,
    congelado: false,
  };
}

/** Quais dos meses pedidos estão fechados, e desde quando. */
export async function fechamentosDosMeses(db: Leitor, usuarioId: string, meses: string[]) {
  const linhas = await db.fechamentoDoMes.findMany({
    where: { usuarioId, competencia: { in: meses } },
    select: { competencia: true, fechado: true, fechadoEm: true },
  });
  return new Map(linhas.map((linha) => [linha.competencia, linha]));
}
