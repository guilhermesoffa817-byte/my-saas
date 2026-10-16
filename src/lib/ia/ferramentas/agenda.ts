import "server-only";

import { paraHorarioLocal } from "@/lib/formato";

import {
  AVISO_CORTADO,
  diaParaData,
  ESQUEMA_PERIODO,
  ferramenta,
  instantesDoPeriodo,
  LINHAS_MAXIMAS,
  percentual,
  somarDiasAoDia,
  validarPeriodo,
  type Periodo,
} from "./base";

export type HorarioDaAgenda = {
  status: string;
  /** "AAAA-MM-DDTHH:mm" no fuso de São Paulo. */
  local: string;
  duracaoMin: number;
  passou: boolean;
};

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
/** Segunda primeiro: é como a semana é vivida num estúdio. */
const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const FAIXAS = [
  { rotulo: "Manhã (antes das 12h)", ate: 12 },
  { rotulo: "Tarde (12h às 18h)", ate: 18 },
  { rotulo: "Noite (a partir das 18h)", ate: 24 },
];

/** Quantas vezes cada dia da semana aparece no período (0 = domingo). */
export function diasDaSemanaNoPeriodo(periodo: Periodo) {
  const contagem = Array(7).fill(0) as number[];
  for (let dia = periodo.inicio; dia <= periodo.fim; dia = somarDiasAoDia(dia, 1)) {
    contagem[diaParaData(dia).getUTCDay()] += 1;
  }
  return contagem;
}

/**
 * A agenda do período, no fuso de São Paulo: por situação, por dia da semana e
 * por faixa de horário. Só contagens e horas; nenhum cliente e nenhuma pessoa
 * da equipe (o assistente não compara gente).
 */
export function analisarAgenda(horarios: HorarioDaAgenda[], periodo: Periodo) {
  const vezes = diasDaSemanaNoPeriodo(periodo);
  const dias = DIAS.map(() => ({ marcados: 0, concluidos: 0, cancelados: 0, minutos: 0 }));
  const faixas = FAIXAS.map(() => 0);
  let concluidos = 0;
  let cancelados = 0;
  let semConclusao = 0;
  let aindaPorVir = 0;

  for (const h of horarios) {
    const dia = dias[diaParaData(h.local.slice(0, 10)).getUTCDay()];
    if (h.status === "cancelado") {
      cancelados += 1;
      dia.cancelados += 1;
      continue;
    }
    dia.marcados += 1;
    dia.minutos += h.duracaoMin;
    const horaLocal = Number(h.local.slice(11, 13));
    faixas[FAIXAS.findIndex((f) => horaLocal < f.ate)] += 1;
    if (h.status === "concluido") {
      concluidos += 1;
      dia.concluidos += 1;
    } else if (h.passou) semConclusao += 1;
    else aindaPorVir += 1;
  }

  const total = horarios.length;
  const horas = (minutos: number) => Math.round(minutos / 6) / 10;
  const naoCancelados = total - cancelados;

  return {
    periodo,
    base: "Horários com início no período, no horário de Brasília. Horas marcadas = duração cadastrada dos serviços, sem os cancelados. O Bossa não guarda o horário de funcionamento, então não há taxa de ocupação: compare os dias entre si, pela média por dia.",
    total_de_horarios: total,
    por_situacao: {
      concluidos,
      cancelados,
      passaram_sem_conclusao: semConclusao,
      ainda_por_vir: aindaPorVir,
    },
    taxa_de_cancelamento: percentual(cancelados, total),
    taxa_que_passou_sem_conclusao: percentual(semConclusao, concluidos + semConclusao),
    observacao_sobre_faltas:
      "O Bossa não tem a situação \"faltou\". Horário que passou sem ser concluído nem cancelado pode ser falta ou só a agenda sem atualizar.",
    por_dia_da_semana: ORDEM_DA_SEMANA.map((i) => ({
      dia: DIAS[i],
      vezes_no_periodo: vezes[i],
      horarios_marcados: dias[i].marcados,
      concluidos: dias[i].concluidos,
      cancelados: dias[i].cancelados,
      horas_marcadas: horas(dias[i].minutos),
      media_de_horarios_por_dia: vezes[i] > 0 ? Math.round((dias[i].marcados * 10) / vezes[i]) / 10 : null,
    })),
    por_faixa_de_horario: FAIXAS.map((f, i) => ({
      faixa: f.rotulo,
      horarios_marcados: faixas[i],
      participacao: percentual(faixas[i], naoCancelados),
    })),
  };
}

export const agendaEOcupacao = ferramenta({
  nome: "agenda_e_ocupacao",
  descricao:
    "Agenda do período, no horário de Brasília: horários por situação (concluídos, cancelados, que passaram sem conclusão), taxa de cancelamento, distribuição por dia da semana (com média por dia) e por faixa de horário, e horas marcadas. Use para perguntas sobre dias e horários vazios, cancelamentos e movimento da agenda.",
  status: "Olhando a agenda…",
  esquema: ESQUEMA_PERIODO,
  validar: validarPeriodo,
  async executar(periodo, ctx) {
    const { de, ate } = instantesDoPeriodo(periodo);
    const agora = Date.now();
    const horarios = await ctx.db.agendamento.findMany({
      where: { usuarioId: ctx.usuarioId, inicio: { gte: de, lt: ate } },
      select: { status: true, inicio: true, servico: { select: { duracaoMin: true } } },
      take: LINHAS_MAXIMAS,
    });
    const resultado = analisarAgenda(
      horarios.map((h) => ({
        status: h.status,
        local: paraHorarioLocal(h.inicio),
        duracaoMin: h.servico.duracaoMin,
        passou: h.inicio.getTime() < agora,
      })),
      periodo,
    );
    return horarios.length >= LINHAS_MAXIMAS ? { ...resultado, aviso: AVISO_CORTADO } : resultado;
  },
});
