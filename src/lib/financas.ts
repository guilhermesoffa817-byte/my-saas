/**
 * As contas da aba Finanças que não dependem do banco.
 *
 * O mês é sempre o de São Paulo, que é onde o estúdio vive. Começar o mês pela
 * meia-noite de Greenwich punha no mês novo o atendimento das 22h do último dia,
 * e o resumo do mês não batia com a agenda.
 */

import { valorDoAtendimento } from "@/lib/atendimento";
import {
  deDataPura,
  deHorarioLocal,
  diaDaSemanaCurto,
  emReais,
  inicioDoMes,
  inicioDoProximoMes,
  paraDataLocal,
  paraDataPura,
  somarDias,
} from "@/lib/formato";

/* ------------------------------------------------------------------ */
/* O mês escolhido                                                     */
/* ------------------------------------------------------------------ */

/** Um mês no formato da URL e das competências: "2026-10". */
const FORMATO_DO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function mesValido(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_DO_MES.test(valor);
}

function partesDoMes(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  return { ano, numero };
}

/** Anda meses para a frente ou para trás, virando o ano quando precisa. */
export function somarMeses(mes: string, quantos: number) {
  const { ano, numero } = partesDoMes(mes);
  const corrido = ano * 12 + (numero - 1) + quantos;
  const novoAno = Math.floor(corrido / 12);
  const novoNumero = corrido - novoAno * 12 + 1;
  return `${novoAno}-${String(novoNumero).padStart(2, "0")}`;
}

/**
 * O mês que a tela vai mostrar.
 *
 * O pedido vem da URL, então pode vir qualquer coisa. Fora do formato, a tela
 * mostra o mês atual. Depois do mês atual não há o que mostrar, porque ainda
 * não aconteceu. Antes do primeiro mês com movimento só haveria tela vazia,
 * então a tela para nele.
 */
export function escolherMes(
  pedido: unknown,
  { atual, primeiro }: { atual: string; primeiro: string },
) {
  if (!mesValido(pedido) || pedido > atual) return atual;
  const maisAntigo = primeiro < atual ? primeiro : atual;
  return pedido < maisAntigo ? maisAntigo : pedido;
}

/**
 * "setembro", ou "setembro de 2025" quando o ano não é o de referência. Sem
 * ano de referência, o ano sempre vai junto.
 */
export function nomeDoMes(mes: string, anoDeReferencia?: number) {
  const { ano, numero } = partesDoMes(mes);
  // Dia 15 ao meio-dia: longe das viradas, o fuso não troca o mês.
  const nome = new Date(Date.UTC(ano, numero - 1, 15, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
  });
  return anoDeReferencia === ano ? nome : `${nome} de ${ano}`;
}

/** O primeiro mês da lista, para a tela não navegar para antes do começo. */
export function mesMaisAntigo(meses: (string | null | undefined)[]) {
  return meses.filter(mesValido).sort()[0] ?? null;
}

/**
 * O começo e o fim do mês em São Paulo, para os horários da agenda: vale o
 * que começa em `inicio` e termina antes de `fim`.
 */
export function limitesDoMes(mes: string) {
  const meioDoMes = deHorarioLocal(`${mes}-15T12:00`)!;
  return { inicio: inicioDoMes(meioDoMes), fim: inicioDoProximoMes(meioDoMes) };
}

/* ------------------------------------------------------------------ */
/* O dia de um lançamento                                              */
/* ------------------------------------------------------------------ */

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/**
 * O dia de calendário de um lançamento, como "2026-10-01".
 *
 * Lançamento é um dia de calendário guardado como instante, e hoje ele chega
 * de dois jeitos. O formulário das Finanças grava a meia-noite de São Paulo. O
 * pagamento de uma cobrança ou de um vencimento grava a data pura, que é a
 * meia-noite de Greenwich e, em São Paulo, ainda é 21h do dia anterior. Lido
 * pelo fuso, esse segundo jeito cairia um dia antes, e o que foi pago no dia 1º
 * iria para o mês passado. Por isso meia-noite exata de Greenwich se lê como
 * data pura, e qualquer outro instante se lê no fuso do estúdio.
 */
export function diaDoLancamento(data: Date) {
  return data.getTime() % DIA_EM_MS === 0 ? paraDataPura(data) : paraDataLocal(data);
}

export function lancamentoDoMes(data: Date, mes: string) {
  return diaDoLancamento(data).startsWith(`${mes}-`);
}

/**
 * Até onde procurar os lançamentos de um mês no banco.
 *
 * Começa na meia-noite de Greenwich do dia 1º, três horas antes do mês de São
 * Paulo, para não perder a data pura do dia 1º. Termina no começo do mês
 * seguinte em São Paulo. O que vier a mais nas pontas, como a data pura do dia
 * 1º do mês seguinte, sai depois com `lancamentoDoMes`.
 */
export function buscaDosLancamentos(mes: string) {
  return { inicio: deDataPura(`${mes}-01`)!, fim: limitesDoMes(mes).fim };
}

/* ------------------------------------------------------------------ */
/* As contas do mês                                                    */
/* ------------------------------------------------------------------ */

type AtendimentoComValor = {
  valorCentavos: number | null;
  servico: { precoCentavos: number };
};

type LancamentoComValor = { tipo: string; valorCentavos: number };

/**
 * O resumo do mês. O atendimento entra pelo valor combinado na hora de marcar,
 * e não pelo preço de hoje do serviço: subir o preço não reescreve o passado.
 */
export function resumoDoMes({
  atendimentos,
  lancamentos,
  impostoPercentual,
}: {
  atendimentos: AtendimentoComValor[];
  lancamentos: LancamentoComValor[];
  impostoPercentual: number;
}) {
  const atendimentosCentavos = atendimentos.reduce(
    (soma, atendimento) => soma + valorDoAtendimento(atendimento),
    0,
  );
  const somar = (lista: LancamentoComValor[]) =>
    lista.reduce((soma, lancamento) => soma + lancamento.valorCentavos, 0);

  const entradasManuais = somar(lancamentos.filter((item) => item.tipo === "entrada"));
  const despesas = lancamentos.filter((item) => item.tipo === "saida");
  const saidas = somar(despesas);

  const entradas = atendimentosCentavos + entradasManuais;
  const imposto = Math.round((entradas * impostoPercentual) / 100);

  return {
    atendimentosCentavos,
    entradasManuais,
    entradas,
    saidas,
    quantasDespesas: despesas.length,
    imposto,
    sobrou: entradas - saidas - imposto,
  };
}

/* ------------------------------------------------------------------ */
/* Os dias da semana                                                   */
/* ------------------------------------------------------------------ */

export const NOMES_DOS_DIAS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
] as const;

/** Quantos dias o gráfico olha para trás. */
export const DIAS_DO_GRAFICO = 90;

/**
 * Quanto cada dia da semana rendeu, de segunda a domingo, na ordem em que a
 * semana é vivida no estúdio. O dia é o de São Paulo.
 */
export function porDiaDaSemana(atendimentos: (AtendimentoComValor & { inicio: Date })[]) {
  const porRotulo = new Map<string, { atendimentos: number; centavos: number }>();
  for (const atendimento of atendimentos) {
    const rotulo = diaDaSemanaCurto(atendimento.inicio);
    const atual = porRotulo.get(rotulo) ?? { atendimentos: 0, centavos: 0 };
    porRotulo.set(rotulo, {
      atendimentos: atual.atendimentos + 1,
      centavos: atual.centavos + valorDoAtendimento(atendimento),
    });
  }

  // Uma segunda-feira conhecida, ao meio-dia, só para tirar as siglas na ordem.
  const segundaDeReferencia = new Date("2026-01-05T15:00:00.000Z");
  return NOMES_DOS_DIAS.map((nomeCompleto, posicao) => {
    const rotulo = diaDaSemanaCurto(somarDias(segundaDeReferencia, posicao));
    const dados = porRotulo.get(rotulo) ?? { atendimentos: 0, centavos: 0 };
    return { rotulo, nomeCompleto, ...dados };
  });
}

/* ------------------------------------------------------------------ */
/* Valores escritos                                                    */
/* ------------------------------------------------------------------ */

/** O sinal de menos tipográfico, que não vira hífen de quebra de linha. */
const MENOS = "−";
const ESPACO_FIRME = " ";

/**
 * O saldo do mês em reais. O negativo sai como um texto só, com o sinal colado
 * ao valor, para o navegador nunca deixar o "−" sozinho numa linha.
 */
export function saldoEmReais(centavos: number) {
  return centavos < 0 ? `${MENOS}${emReais(-centavos)}` : emReais(centavos);
}

/** "+ R$ 150,00" ou "− R$ 150,00", sem ponto de quebra entre o sinal e o valor. */
export function lancamentoEmReais(tipo: string, centavos: number) {
  const sinal = tipo === "entrada" ? "+" : MENOS;
  return `${sinal}${ESPACO_FIRME}${emReais(centavos)}`;
}

/* ------------------------------------------------------------------ */
/* O que vem do formulário                                             */
/* ------------------------------------------------------------------ */

/** O maior valor aceito num lançamento: um milhão de reais. */
export const MAIOR_LANCAMENTO_CENTAVOS = 100_000_000;

/**
 * Lê o valor de um lançamento e devolve centavos, ou null.
 *
 * Aceita "1.234,56", "1234,56", "1234.56" e "1.234". Ponto seguido de grupos
 * de três dígitos, sem vírgula, é separador de milhar, que é como se escreve
 * no Brasil: "1.500" é mil e quinhentos, não um real e cinquenta.
 */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/\s|R\$/g, "");
  if (!/^[\d.,]+$/.test(limpo)) return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const centavos = Math.round(Number(normalizado) * 100);
  if (!Number.isFinite(centavos) || centavos <= 0) return null;
  if (centavos > MAIOR_LANCAMENTO_CENTAVOS) return null;
  return centavos;
}

/**
 * Lê o percentual do imposto: "6", "6%", "4,5". O banco guarda número inteiro,
 * então o que tiver casa decimal é arredondado, e a tela diz o valor guardado.
 */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d+)?$/.test(limpo)) return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) return null;
  return Math.round(numero);
}
