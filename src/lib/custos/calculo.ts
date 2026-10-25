import { somarMeses } from "@/lib/formato";
import { ehRetirada } from "./regras";

/**
 * Custos operacionais: visão gerencial, não contábil.
 *
 * Tudo aqui é função pura e trabalha em centavos inteiros. As contas que
 * multiplicam dois valores em centavos passam por BigInt, porque R$ 1 milhão
 * vezes R$ 1 milhão, em centavos, já passa do maior inteiro seguro do
 * JavaScript, e um número errado aqui vira uma decisão errada no estúdio.
 *
 * O mês é sempre "AAAA-MM" no fuso do estúdio: quem monta as despesas e as
 * receitas (custos/operacoes.ts) já converte as datas antes de chegar aqui.
 */

/** Os mesmos valores aceitos pela coluna `Lancamento.natureza`. */
export const NATUREZAS = ["fixo", "variavel", "nao_operacional"] as const;
export type Natureza = (typeof NATUREZAS)[number];

/** Os mesmos valores aceitos pela coluna `Lancamento.naturezaOrigem`. */
export const ORIGENS = ["regra", "ia", "voce"] as const;
export type OrigemDaNatureza = (typeof ORIGENS)[number];

export const ROTULO_DA_NATUREZA: Record<Natureza, string> = {
  fixo: "Fixo",
  variavel: "Variável",
  nao_operacional: "Fora da operação",
};

export const ROTULO_DA_ORIGEM: Record<OrigemDaNatureza, string> = {
  regra: "Regra",
  ia: "Sugestão da IA",
  voce: "Você",
};

/**
 * O rótulo da origem na tela. Com a IA desligada no servidor, nada no painel
 * fala dela: uma classificação antiga que veio da IA (ou a do estúdio de
 * exemplo) aparece como sugestão automática, que é o que ela é para quem lê.
 */
export function rotuloDaOrigem(origem: OrigemDaNatureza, iaLigada: boolean) {
  if (origem === "ia" && !iaLigada) return "Sugestão automática";
  return ROTULO_DA_ORIGEM[origem];
}

/** O que vem do banco ou do formulário é texto: estas conferem antes de confiar. */
export function ehNatureza(valor: unknown): valor is Natureza {
  return typeof valor === "string" && (NATUREZAS as readonly string[]).includes(valor);
}

export function ehOrigem(valor: unknown): valor is OrigemDaNatureza {
  return typeof valor === "string" && (ORIGENS as readonly string[]).includes(valor);
}

/** Uma saída do caixa, do jeito que a tela de Custos precisa. */
export type DespesaParaCusto = {
  id: string;
  descricao: string;
  /** Texto livre, como a pessoa digitou. */
  categoria: string | null;
  valorCentavos: number;
  /** "AAAA-MM" no fuso do estúdio. */
  mes: string;
  /** "AAAA-MM-DD" no fuso do estúdio, para mostrar e ordenar. */
  dia: string;
  natureza: Natureza | null;
  origem: OrigemDaNatureza | null;
  motivo: string | null;
  /** Nasceu de um pagamento da Equipe. */
  daEquipe: boolean;
};

/** Uma entrada de dinheiro: atendimento concluído ou entrada lançada à mão. */
export type ReceitaParaCusto = {
  mes: string;
  valorCentavos: number;
  /** true quando veio de um atendimento concluído, que conta no equilíbrio em atendimentos. */
  atendimento: boolean;
};

export function receitaDoMes(receitas: ReceitaParaCusto[], mes: string) {
  let receitaCentavos = 0;
  let atendimentos = 0;
  for (const receita of receitas) {
    if (receita.mes !== mes) continue;
    receitaCentavos += receita.valorCentavos;
    if (receita.atendimento) atendimentos += 1;
  }
  return { receitaCentavos, atendimentos };
}

export type TotaisDeCustos = {
  receitaCentavos: number;
  fixosCentavos: number;
  variaveisCentavos: number;
  foraDaOperacaoCentavos: number;
  semClassificacaoCentavos: number;
  /** Só informação: retirada da dona não entra em nenhuma conta de custo. */
  retiradasCentavos: number;
  quantidadeSemClassificacao: number;
  /** Atendimentos concluídos no mês. */
  atendimentos: number;
};

export function somarCustos(params: {
  despesas: DespesaParaCusto[];
  receitaCentavos: number;
  atendimentos: number;
}): TotaisDeCustos {
  const totais: TotaisDeCustos = {
    receitaCentavos: params.receitaCentavos,
    fixosCentavos: 0,
    variaveisCentavos: 0,
    foraDaOperacaoCentavos: 0,
    semClassificacaoCentavos: 0,
    retiradasCentavos: 0,
    quantidadeSemClassificacao: 0,
    atendimentos: params.atendimentos,
  };
  for (const despesa of params.despesas) {
    if (ehRetirada(despesa)) totais.retiradasCentavos += despesa.valorCentavos;
    else if (despesa.natureza === "fixo") totais.fixosCentavos += despesa.valorCentavos;
    else if (despesa.natureza === "variavel") totais.variaveisCentavos += despesa.valorCentavos;
    else if (despesa.natureza === "nao_operacional") {
      totais.foraDaOperacaoCentavos += despesa.valorCentavos;
    } else {
      totais.semClassificacaoCentavos += despesa.valorCentavos;
      totais.quantidadeSemClassificacao += 1;
    }
  }
  return totais;
}

const ZERO = BigInt(0);
const UM = BigInt(1);
const DOIS = BigInt(2);
const DEZ_MIL = BigInt(10_000);

/** Divisão inteira arredondada para cima; `d` precisa ser positivo. */
export function dividirParaCima(n: bigint, d: bigint): bigint {
  if (d <= ZERO) throw new Error("Divisor precisa ser positivo.");
  if (n <= ZERO) return ZERO;
  return (n + d - UM) / d;
}

/** Divisão inteira com arredondamento comercial (o meio vai para longe do zero). */
export function dividirArredondando(n: bigint, d: bigint): bigint {
  if (d <= ZERO) throw new Error("Divisor precisa ser positivo.");
  const negativo = n < ZERO;
  const absoluto = negativo ? -n : n;
  const resultado = (absoluto * DOIS + d) / (d * DOIS);
  return negativo ? -resultado : resultado;
}

export type SituacaoDoPontoDeEquilibrio =
  | "calculado"
  /** Sem custo fixo classificado no mês: não há o que cobrir. */
  | "sem_custos_fixos"
  /** Nada entrou no mês. */
  | "sem_receita"
  /** Os custos variáveis já levam tudo o que entra. */
  | "margem_insuficiente";

export type IndicadoresDeCustos = {
  /** Receita menos custos variáveis. */
  margemDeContribuicaoCentavos: number;
  /** Margem ÷ receita, em pontos-base (10.000 = 100%). `null` sem receita. */
  indiceDeMargemPontosBase: number | null;
  /**
   * O X de "De cada R$ 100 que entram, sobram R$ X", em centavos. É o mesmo
   * número do índice em pontos-base (R$ 100 = 10.000 centavos), com nome
   * próprio para ninguém precisar lembrar disso.
   */
  sobraACadaCemReaisCentavos: number | null;
  situacaoDoPontoDeEquilibrio: SituacaoDoPontoDeEquilibrio;
  /** Fixos × receita ÷ margem, arredondado para cima. */
  pontoDeEquilibrioCentavos: number | null;
  /** Fixos ÷ margem média por atendimento, arredondado para cima. */
  pontoDeEquilibrioAtendimentos: number | null;
  /** Custos fixos ÷ receita, em pontos-base. */
  pesoDosFixosPontosBase: number | null;
};

export function calcularIndicadores(totais: TotaisDeCustos): IndicadoresDeCustos {
  const receita = BigInt(totais.receitaCentavos);
  const fixos = BigInt(totais.fixosCentavos);
  const margem = receita - BigInt(totais.variaveisCentavos);
  const temReceita = totais.receitaCentavos > 0;

  const indice = temReceita ? Number(dividirArredondando(margem * DEZ_MIL, receita)) : null;
  const pesoDosFixos = temReceita ? Number(dividirArredondando(fixos * DEZ_MIL, receita)) : null;

  let situacao: SituacaoDoPontoDeEquilibrio;
  if (totais.fixosCentavos <= 0) situacao = "sem_custos_fixos";
  else if (!temReceita) situacao = "sem_receita";
  else if (margem <= ZERO) situacao = "margem_insuficiente";
  else situacao = "calculado";

  let pontoDeEquilibrioCentavos: number | null = null;
  let pontoDeEquilibrioAtendimentos: number | null = null;
  if (situacao === "calculado") {
    pontoDeEquilibrioCentavos = Number(dividirParaCima(fixos * receita, margem));
    if (totais.atendimentos > 0) {
      // fixos ÷ (margem ÷ n) = fixos × n ÷ margem: sem perder centavo na média.
      pontoDeEquilibrioAtendimentos = Number(
        dividirParaCima(fixos * BigInt(totais.atendimentos), margem),
      );
    }
  }

  return {
    margemDeContribuicaoCentavos: Number(margem),
    indiceDeMargemPontosBase: indice,
    sobraACadaCemReaisCentavos: indice,
    situacaoDoPontoDeEquilibrio: situacao,
    pontoDeEquilibrioCentavos,
    pontoDeEquilibrioAtendimentos,
    pesoDosFixosPontosBase: pesoDosFixos,
  };
}

const MES_VALIDO = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function mesValido(mes: unknown): mes is string {
  return typeof mes === "string" && MES_VALIDO.test(mes);
}

/** "AAAA-MM" somado de `meses` (negativo volta). Conta pura, sem fuso. */
export function deslocarMes(mes: string, meses: number) {
  return somarMeses(mes, meses);
}

/** "2026-10" → "out". */
export function rotuloCurtoDoMes(mes: string) {
  const [ano, mesDoAno] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, mesDoAno - 1, 15))
    .toLocaleDateString("pt-BR", { timeZone: "UTC", month: "short" })
    .replace(".", "");
}

export type MesDaTendencia = {
  mes: string;
  rotulo: string;
  fixosCentavos: number;
  variaveisCentavos: number;
};

/** Fixos e variáveis dos seis meses que terminam em `mesFinal`. */
export function tendenciaDeSeisMeses(
  despesas: DespesaParaCusto[],
  mesFinal: string,
): MesDaTendencia[] {
  const meses: MesDaTendencia[] = Array.from({ length: 6 }, (_, indice) => {
    const mes = deslocarMes(mesFinal, indice - 5);
    return { mes, rotulo: rotuloCurtoDoMes(mes), fixosCentavos: 0, variaveisCentavos: 0 };
  });
  const porMes = new Map(meses.map((item) => [item.mes, item]));
  for (const despesa of despesas) {
    if (ehRetirada(despesa)) continue;
    const alvo = porMes.get(despesa.mes);
    if (!alvo) continue;
    if (despesa.natureza === "fixo") alvo.fixosCentavos += despesa.valorCentavos;
    else if (despesa.natureza === "variavel") alvo.variaveisCentavos += despesa.valorCentavos;
  }
  return meses;
}

export type ComparacaoComMesAnterior = {
  mes: string;
  receitaCentavos: number;
  fixosCentavos: number;
  variaveisCentavos: number;
  margemDeContribuicaoCentavos: number;
  /** Atual menos anterior, em centavos. */
  diferencaReceitaCentavos: number;
  diferencaFixosCentavos: number;
  diferencaVariaveisCentavos: number;
  diferencaMargemCentavos: number;
};

export function compararComMesAnterior(params: {
  mesAnterior: string;
  atual: TotaisDeCustos;
  anterior: TotaisDeCustos;
}): ComparacaoComMesAnterior {
  const { atual, anterior } = params;
  const margemAtual = atual.receitaCentavos - atual.variaveisCentavos;
  const margemAnterior = anterior.receitaCentavos - anterior.variaveisCentavos;
  return {
    mes: params.mesAnterior,
    receitaCentavos: anterior.receitaCentavos,
    fixosCentavos: anterior.fixosCentavos,
    variaveisCentavos: anterior.variaveisCentavos,
    margemDeContribuicaoCentavos: margemAnterior,
    diferencaReceitaCentavos: atual.receitaCentavos - anterior.receitaCentavos,
    diferencaFixosCentavos: atual.fixosCentavos - anterior.fixosCentavos,
    diferencaVariaveisCentavos: atual.variaveisCentavos - anterior.variaveisCentavos,
    diferencaMargemCentavos: margemAtual - margemAnterior,
  };
}

export type ResumoDeCustos = TotaisDeCustos &
  IndicadoresDeCustos & {
    mes: string;
    mesAnterior: ComparacaoComMesAnterior;
    tendencia: MesDaTendencia[];
    /** Despesas do mês, sem as retiradas. Maiores primeiro. */
    despesas: DespesaParaCusto[];
  };

/** Recebe seis meses de movimento e devolve o resumo do último. */
export function montarResumoDeCustos(params: {
  mes: string;
  despesas: DespesaParaCusto[];
  receitas: ReceitaParaCusto[];
}): ResumoDeCustos {
  const { mes } = params;
  const mesAnterior = deslocarMes(mes, -1);

  const doMes = (alvo: string) => params.despesas.filter((item) => item.mes === alvo);
  const totais = (alvo: string) =>
    somarCustos({ despesas: doMes(alvo), ...receitaDoMes(params.receitas, alvo) });

  const atual = totais(mes);
  const anterior = totais(mesAnterior);

  return {
    mes,
    ...atual,
    ...calcularIndicadores(atual),
    mesAnterior: compararComMesAnterior({ mesAnterior, atual, anterior }),
    tendencia: tendenciaDeSeisMeses(params.despesas, mes),
    despesas: doMes(mes)
      .filter((item) => !ehRetirada(item))
      .sort((a, b) => b.valorCentavos - a.valorCentavos || a.dia.localeCompare(b.dia)),
  };
}
