/**
 * As consultas da aba Finanças, num lugar só.
 *
 * Ficam fora da página para que o teste de banco rode exatamente estas
 * consultas, e não uma cópia delas. Toda consulta recebe o estúdio e filtra por
 * ele: um estúdio nunca enxerga o dinheiro do outro.
 */

import type { PrismaClient } from "@/generated/prisma";
import {
  DIAS_DO_GRAFICO,
  buscaDosLancamentos,
  diaDoLancamento,
  lancamentoDoMes,
  limitesDoMes,
  mesMaisAntigo,
} from "@/lib/financas";
import { competenciaAtual, inicioDoDia, somarDias } from "@/lib/formato";

/** O que o resumo precisa de cada atendimento: o combinado e o preço do serviço. */
const VALOR_DO_ATENDIMENTO = {
  valorCentavos: true,
  servico: { select: { precoCentavos: true } },
} as const;

/** Os atendimentos concluídos e os lançamentos de um mês, de um estúdio. */
export async function movimentoDoMes(db: PrismaClient, usuarioId: string, mes: string) {
  const { inicio, fim } = limitesDoMes(mes);
  const busca = buscaDosLancamentos(mes);

  const [atendimentos, lancamentos] = await Promise.all([
    db.agendamento.findMany({
      where: { usuarioId, status: "concluido", inicio: { gte: inicio, lt: fim } },
      select: VALOR_DO_ATENDIMENTO,
    }),
    db.lancamento.findMany({
      where: { usuarioId, data: { gte: busca.inicio, lt: busca.fim } },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        categoria: true,
        valorCentavos: true,
        data: true,
        criadoEm: true,
      },
    }),
  ]);

  // Do dia mais recente para o mais antigo; no mesmo dia, o último registrado
  // primeiro. A ordem é pelo dia de calendário, que é o que a tela mostra.
  const doMes = lancamentos
    .filter((lancamento) => lancamentoDoMes(lancamento.data, mes))
    .map((lancamento) => ({ ...lancamento, dia: diaDoLancamento(lancamento.data) }))
    .sort(
      (a, b) =>
        b.dia.localeCompare(a.dia) || b.criadoEm.getTime() - a.criadoEm.getTime(),
    );

  return { atendimentos, lancamentos: doMes };
}

/**
 * Os atendimentos concluídos dos últimos noventa dias, até o fim de hoje, para
 * o gráfico dos dias da semana. Não depende do mês escolhido.
 */
export async function atendimentosDoGrafico(
  db: PrismaClient,
  usuarioId: string,
  agora: Date,
) {
  const comecoDeHoje = inicioDoDia(agora);
  return db.agendamento.findMany({
    where: {
      usuarioId,
      status: "concluido",
      inicio: {
        gte: somarDias(comecoDeHoje, -DIAS_DO_GRAFICO),
        lt: somarDias(comecoDeHoje, 1),
      },
    },
    select: { inicio: true, ...VALOR_DO_ATENDIMENTO },
  });
}

/**
 * O primeiro mês com alguma coisa para mostrar: o da criação da conta, ou um
 * mais antigo, se a dona lançou despesa ou atendimento de antes de chegar.
 */
export async function primeiroMesComMovimento(
  db: PrismaClient,
  usuario: { id: string; criadoEm: Date },
) {
  const [lancamento, atendimento] = await Promise.all([
    db.lancamento.findFirst({
      where: { usuarioId: usuario.id },
      orderBy: { data: "asc" },
      select: { data: true },
    }),
    db.agendamento.findFirst({
      where: { usuarioId: usuario.id, status: "concluido" },
      orderBy: { inicio: "asc" },
      select: { inicio: true },
    }),
  ]);

  return (
    mesMaisAntigo([
      competenciaAtual(usuario.criadoEm),
      lancamento ? diaDoLancamento(lancamento.data).slice(0, 7) : null,
      atendimento ? competenciaAtual(atendimento.inicio) : null,
    ]) ?? competenciaAtual(usuario.criadoEm)
  );
}
