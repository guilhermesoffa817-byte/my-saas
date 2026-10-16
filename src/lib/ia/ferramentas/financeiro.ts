import "server-only";

import { ehRetirada } from "@/lib/custos/regras";
import { nomesParaOcultar } from "@/lib/custos/operacoes";
import { paraDataLocal } from "@/lib/formato";
import { ocultarNomes, sanitizarParaIA } from "@/lib/ia/sanitizar";

import {
  AVISO_CORTADO,
  brl,
  diasDoPeriodo,
  ESQUEMA_PERIODO,
  ferramenta,
  instantesDoPeriodo,
  LINHAS_MAXIMAS,
  media,
  percentual,
  periodoAnterior,
  validarPeriodo,
  variacao,
  type ContextoFerramenta,
  type Periodo,
} from "./base";

/**
 * Um movimento de dinheiro, do jeito que a página Finanças conta: atendimento
 * concluído (pelo preço do serviço) ou lançamento feito à mão.
 */
export type MovimentoDoResumo = {
  tipo: "entrada" | "saida";
  valorCentavos: number;
  /** "AAAA-MM-DD" no fuso de São Paulo. */
  dia: string;
  /** Texto livre da dona. Sai daqui limpo de documento, contato e nome. */
  categoria: string | null;
  /** Só para separar a retirada da dona; nunca sai daqui. */
  descricao: string;
  atendimento: boolean;
};

/** Menos que isso de movimento registrado, o assistente avisa que a análise é frágil. */
export const DIAS_MINIMOS_DE_HISTORICO = 30;

export function descreverHistorico(primeiroDia: string | null, hoje: string) {
  if (!primeiroDia) return { primeiro_registro_em: null, dias_de_historico: 0, poucos_dados: true };
  const dias = Math.max(0, diasDoPeriodo({ inicio: primeiroDia, fim: hoje }));
  return {
    primeiro_registro_em: primeiroDia,
    dias_de_historico: dias,
    poucos_dados: dias < DIAS_MINIMOS_DE_HISTORICO,
  };
}

function totais(lista: MovimentoDoResumo[]) {
  let atendimentos = 0;
  let quantidadeDeAtendimentos = 0;
  let entradasLancadas = 0;
  let saidas = 0;
  let retiradas = 0;
  for (const m of lista) {
    if (m.tipo === "entrada") {
      if (m.atendimento) {
        atendimentos += m.valorCentavos;
        quantidadeDeAtendimentos += 1;
      } else entradasLancadas += m.valorCentavos;
    } else if (ehRetirada(m)) retiradas += m.valorCentavos;
    else saidas += m.valorCentavos;
  }
  const entradas = atendimentos + entradasLancadas;
  return { atendimentos, quantidadeDeAtendimentos, entradasLancadas, entradas, saidas, retiradas, resultado: entradas - saidas };
}

function porCategoria(lista: MovimentoDoResumo[], total: number, limite: number, nomes: string[]) {
  const mapa = new Map<string, number>();
  for (const m of lista) {
    const limpa = m.categoria ? ocultarNomes(sanitizarParaIA(m.categoria.trim()), nomes).slice(0, 60) : "";
    const nome = limpa || "Sem categoria";
    mapa.set(nome, (mapa.get(nome) ?? 0) + m.valorCentavos);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([categoria, centavos]) => ({ categoria, ...brl(centavos), participacao: percentual(centavos, total) }));
}

/**
 * Regime de caixa, igual à página Finanças: atendimentos concluídos pelo preço
 * do serviço mais as entradas lançadas; saídas lançadas. A retirada da dona
 * não é custo: fica numa linha à parte. Descrição de lançamento nunca sai
 * daqui (a do pagamento da equipe traz o nome da pessoa); só as categorias,
 * limpas.
 */
export function resumirFinanceiro(params: {
  movimentos: MovimentoDoResumo[];
  periodo: Periodo;
  primeiroDia: string | null;
  hoje: string;
  nomesDePessoas?: string[];
}) {
  const { periodo } = params;
  const nomes = params.nomesDePessoas ?? [];
  const anterior = periodoAnterior(periodo);
  const doPeriodo = params.movimentos.filter((m) => m.dia >= periodo.inicio && m.dia <= periodo.fim);
  const doAnterior = params.movimentos.filter((m) => m.dia >= anterior.inicio && m.dia <= anterior.fim);
  const atual = totais(doPeriodo);
  const antes = totais(doAnterior);

  const saidasDoPeriodo = doPeriodo.filter((m) => m.tipo === "saida" && !ehRetirada(m));
  const entradasLancadas = doPeriodo.filter((m) => m.tipo === "entrada" && !m.atendimento);

  return {
    periodo: { ...periodo, dias: diasDoPeriodo(periodo) },
    historico: descreverHistorico(params.primeiroDia, params.hoje),
    base: "Regime de caixa, como na página Finanças: atendimentos concluídos (pelo preço do serviço) mais entradas lançadas; saídas lançadas. Retirada da dona não entra como custo. Não inclui imposto.",
    entradas: brl(atual.entradas),
    entradas_de_atendimentos: brl(atual.atendimentos),
    entradas_lancadas_a_mao: brl(atual.entradasLancadas),
    atendimentos_concluidos: atual.quantidadeDeAtendimentos,
    ticket_medio_por_atendimento: brl(media(atual.atendimentos, atual.quantidadeDeAtendimentos)),
    saidas: brl(atual.saidas),
    resultado: brl(atual.resultado),
    margem: percentual(atual.resultado, atual.entradas),
    retiradas_da_dona: brl(atual.retiradas),
    sobrou_depois_das_retiradas: brl(atual.resultado - atual.retiradas),
    maiores_categorias_de_saida: porCategoria(saidasDoPeriodo, atual.saidas, 8, nomes),
    maiores_categorias_de_entrada_lancada: porCategoria(entradasLancadas, atual.entradasLancadas, 5, nomes),
    periodo_anterior: {
      ...anterior,
      entradas: brl(antes.entradas),
      saidas: brl(antes.saidas),
      resultado: brl(antes.resultado),
      atendimentos_concluidos: antes.quantidadeDeAtendimentos,
    },
    variacao_sobre_o_periodo_anterior: {
      entradas: variacao(atual.entradas, antes.entradas),
      saidas: variacao(atual.saidas, antes.saidas),
      resultado: variacao(atual.resultado, antes.resultado),
      atendimentos_concluidos: variacao(atual.quantidadeDeAtendimentos, antes.quantidadeDeAtendimentos),
    },
  };
}

/** O primeiro dia com movimento registrado: atendimento concluído ou lançamento. */
export async function primeiroDiaComMovimento(ctx: Pick<ContextoFerramenta, "db" | "usuarioId">) {
  const [atendimento, lancamento] = await Promise.all([
    ctx.db.agendamento.findFirst({
      where: { usuarioId: ctx.usuarioId, status: "concluido" },
      orderBy: { inicio: "asc" },
      select: { inicio: true },
    }),
    ctx.db.lancamento.findFirst({
      where: { usuarioId: ctx.usuarioId },
      orderBy: { data: "asc" },
      select: { data: true },
    }),
  ]);
  const dias = [atendimento?.inicio, lancamento?.data].filter((d): d is Date => Boolean(d)).map(paraDataLocal);
  return dias.length ? dias.sort()[0] : null;
}

export const resumoFinanceiro = ferramenta({
  nome: "resumo_financeiro",
  descricao:
    "Entradas e saídas do período em regime de caixa: atendimentos concluídos, entradas e saídas lançadas, resultado, margem, maiores categorias, retiradas da dona à parte e comparação com o período anterior (os meses civis anteriores quando o período é de meses inteiros; senão, o mesmo número de dias logo antes). Também diz quantos dias de histórico o negócio tem. Use antes de afirmar qualquer número de faturamento, lucro ou despesa.",
  status: "Lendo o financeiro…",
  esquema: ESQUEMA_PERIODO,
  validar: validarPeriodo,
  async executar(periodo, ctx) {
    const anterior = periodoAnterior(periodo);
    const { de } = instantesDoPeriodo(anterior);
    const { ate } = instantesDoPeriodo(periodo);
    const [atendimentos, lancamentos, primeiroDia, nomes] = await Promise.all([
      ctx.db.agendamento.findMany({
        where: { usuarioId: ctx.usuarioId, status: "concluido", inicio: { gte: de, lt: ate } },
        select: { inicio: true, servico: { select: { precoCentavos: true } } },
        take: LINHAS_MAXIMAS,
      }),
      ctx.db.lancamento.findMany({
        where: { usuarioId: ctx.usuarioId, data: { gte: de, lt: ate } },
        select: { tipo: true, valorCentavos: true, data: true, categoria: true, descricao: true },
        take: LINHAS_MAXIMAS,
      }),
      primeiroDiaComMovimento(ctx),
      nomesParaOcultar(ctx.db, ctx.usuarioId),
    ]);

    const movimentos: MovimentoDoResumo[] = [
      ...atendimentos.map((a) => ({
        tipo: "entrada" as const,
        valorCentavos: a.servico.precoCentavos,
        dia: paraDataLocal(a.inicio),
        categoria: null,
        descricao: "",
        atendimento: true,
      })),
      ...lancamentos.map((l) => ({
        tipo: l.tipo === "entrada" ? ("entrada" as const) : ("saida" as const),
        valorCentavos: l.valorCentavos,
        dia: paraDataLocal(l.data),
        categoria: l.categoria,
        descricao: l.descricao,
        atendimento: false,
      })),
    ];
    const resumo = resumirFinanceiro({ movimentos, periodo, primeiroDia, hoje: ctx.hoje, nomesDePessoas: nomes });
    const cortado = atendimentos.length >= LINHAS_MAXIMAS || lancamentos.length >= LINHAS_MAXIMAS;
    return cortado ? { ...resumo, aviso: AVISO_CORTADO } : resumo;
  },
});
