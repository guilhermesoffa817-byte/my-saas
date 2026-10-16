import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { deHorarioLocal, emReais, somarMeses } from "@/lib/formato";

/**
 * O que toda ferramenta do assistente recebe do SERVIDOR. O estúdio vem da
 * sessão, nunca da entrada que o modelo manda: o modelo só escolhe datas.
 */
export type ContextoFerramenta = {
  db: PrismaClient;
  usuarioId: string;
  /** Hoje, no calendário de São Paulo ("2026-10-16"). */
  hoje: string;
};

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type Ferramenta<T = unknown> = {
  nome: string;
  descricao: string;
  /** Texto curto que a tela mostra enquanto a ferramenta roda. */
  status: string;
  /** JSON Schema da entrada, como vai para a API. */
  esquema: Record<string, unknown>;
  /** A API valida pelo esquema, mas aqui confere de novo: a entrada vem do modelo. */
  validar: (entrada: unknown) => Validacao<T>;
  executar: (entrada: T, ctx: ContextoFerramenta) => Promise<unknown>;
};

export function ferramenta<T>(f: Ferramenta<T>) {
  return f;
}

/* ------------------------------------------------------------------ datas */

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Maior período que uma ferramenta aceita. Mais que isso é caro e raramente útil. */
export const MESES_MAXIMOS = 24;

/** Dia ao meio-dia UTC: somar e subtrair dias nunca muda a data por causa de fuso. */
export const diaParaData = (dia: string) => new Date(`${dia}T12:00:00Z`);
export const dataParaDia = (data: Date) => data.toISOString().slice(0, 10);

export function somarDiasAoDia(dia: string, dias: number) {
  return dataParaDia(new Date(diaParaData(dia).getTime() + dias * 86_400_000));
}

function diaValido(dia: unknown): dia is string {
  return typeof dia === "string" && DIA.test(dia) && dataParaDia(diaParaData(dia)) === dia;
}

export function mesValido(mes: unknown): mes is string {
  return typeof mes === "string" && MES.test(mes);
}

/** "AAAA-MM" somado de `meses` (negativo volta). */
export function deslocarMes(mes: string, meses: number) {
  return somarMeses(mes, meses);
}

export type Periodo = { inicio: string; fim: string };

export function diasDoPeriodo(p: Periodo) {
  return Math.round((diaParaData(p.fim).getTime() - diaParaData(p.inicio).getTime()) / 86_400_000) + 1;
}

/** Primeiro e último dia de um mês "AAAA-MM". */
export function periodoDoMes(mes: string): Periodo {
  const inicio = `${mes}-01`;
  return { inicio, fim: somarDiasAoDia(`${deslocarMes(mes, 1)}-01`, -1) };
}

/** O período começa no dia 1º e termina no último dia de um mês? */
function mesesInteiros(p: Periodo) {
  return p.inicio.endsWith("-01") && p.fim === periodoDoMes(p.fim.slice(0, 7)).fim;
}

function mesesEntre(p: Periodo) {
  const [a1, m1] = p.inicio.split("-").map(Number);
  const [a2, m2] = p.fim.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

/**
 * O período logo antes, para comparar. Meses inteiros se comparam com os
 * meses civis anteriores (outubro com setembro inteiro, jul–set com abr–jun),
 * que é como a dona pensa. Nos outros casos, o mesmo número de dias logo antes.
 */
export function periodoAnterior(p: Periodo): Periodo {
  const fim = somarDiasAoDia(p.inicio, -1);
  if (mesesInteiros(p)) {
    return { inicio: `${deslocarMes(p.inicio.slice(0, 7), -mesesEntre(p))}-01`, fim };
  }
  return { inicio: somarDiasAoDia(fim, -(diasDoPeriodo(p) - 1)), fim };
}

/** Instantes de meia-noite a meia-noite em São Paulo: [de, ate). */
export function instantesDoPeriodo(p: Periodo) {
  return {
    de: deHorarioLocal(`${p.inicio}T00:00`)!,
    ate: deHorarioLocal(`${somarDiasAoDia(p.fim, 1)}T00:00`)!,
  };
}

/** Entrada {inicio, fim}: datas válidas, na ordem e com no máximo 24 meses. */
export function validarPeriodo(entrada: unknown): Validacao<Periodo> {
  const { inicio, fim } = (entrada ?? {}) as Record<string, unknown>;
  if (!diaValido(inicio)) return { ok: false, erro: "Data inicial inválida: use AAAA-MM-DD." };
  if (!diaValido(fim)) return { ok: false, erro: "Data final inválida: use AAAA-MM-DD." };
  if (fim < inicio) return { ok: false, erro: "A data final vem antes da inicial." };
  const limite = `${deslocarMes(inicio.slice(0, 7), MESES_MAXIMOS)}${inicio.slice(7)}`;
  if (fim >= limite) {
    return { ok: false, erro: `Período longo demais: o máximo é ${MESES_MAXIMOS} meses.` };
  }
  return { ok: true, dados: { inicio, fim } };
}

export const ESQUEMA_PERIODO = {
  type: "object",
  properties: {
    inicio: { type: "string", description: "Primeiro dia do período, AAAA-MM-DD." },
    fim: { type: "string", description: "Último dia do período (inclusive), AAAA-MM-DD." },
  },
  required: ["inicio", "fim"],
  additionalProperties: false,
};

export function validarMes(entrada: unknown): Validacao<{ mes: string }> {
  const { mes } = (entrada ?? {}) as Record<string, unknown>;
  if (!mesValido(mes)) return { ok: false, erro: "Mês inválido: use AAAA-MM." };
  return { ok: true, dados: { mes } };
}

export const ESQUEMA_MES = {
  type: "object",
  properties: { mes: { type: "string", description: "Mês no formato AAAA-MM." } },
  required: ["mes"],
  additionalProperties: false,
};

/* --------------------------------------------------------------- números */

/** Dinheiro para o modelo: centavos inteiros e o texto já pronto (ele não divide nada). */
export function brl(centavos: number) {
  return { centavos, texto: emReais(centavos) };
}

const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Parte de um total, como texto ("12,5%"). Sem total, não há percentual. */
export function percentual(parte: number, total: number) {
  return total > 0 ? porcento.format(parte / total) : null;
}

/** Variação de um período para o outro ("+12,5%"). */
export function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual === 0 ? "sem variação" : "sem base de comparação";
  const texto = porcento.format((atual - anterior) / Math.abs(anterior));
  return atual >= anterior ? `+${texto}` : texto;
}

/** Média inteira arredondada: média de centavos continua em centavos. */
export function media(total: number, quantidade: number) {
  return quantidade > 0 ? Math.round(total / quantidade) : 0;
}

/** Teto de linhas lidas por consulta: um estúdio pequeno nem chega perto. */
export const LINHAS_MAXIMAS = 20_000;

export const AVISO_CORTADO =
  "Há mais registros do que o assistente consegue ler de uma vez; os números deste período estão incompletos. Use um período menor.";
