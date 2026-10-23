/**
 * O relatório do mês, montado a partir de listas simples, sem banco e sem tela.
 *
 * Tudo aqui é função pura e trabalha em centavos inteiros. Quem lê o banco
 * (relatorio/operacoes.ts) entrega as linhas; a tela, a planilha, o CSV, a
 * página do contador e o resumo congelado do fechamento saem todos deste
 * mesmo objeto, então nenhum deles discorda dos outros.
 *
 * Sem contar duas vezes: as Finanças somam o preço dos atendimentos concluídos
 * e os lançamentos de entrada. Cobrança que nasceu de um horário da agenda não
 * vira lançamento ao ser paga (o atendimento já está na conta); cobrança solta
 * vira um lançamento de entrada. Por isso as "cobranças recebidas" do relatório
 * são exatamente esses lançamentos, separados das entradas manuais, e o total
 * de entradas bate com o "Entrou" da tela de Finanças.
 */
import {
  competenciaAtual,
  competenciaPorExtenso,
  paraDataLocal,
  somarMeses,
} from "@/lib/formato";
import { ROTULO_DA_NATUREZA, ehNatureza } from "@/lib/custos/calculo";
import { ehRetirada } from "@/lib/custos/regras";
import { ROTULO_DO_PAGAMENTO, ehTipoDePagamento } from "@/lib/equipe";

export const VERSAO_DO_RELATORIO = 1;

export const AVISO_DO_IMPOSTO =
  "Imposto estimado é uma conta aproximada, feita com o percentual que você informou nas Finanças. Não é guia nem apuração fiscal: o valor certo quem calcula é o seu contador.";

export const AVISO_DAS_COBRANCAS =
  "Cobranças da agenda recebidas não somam de novo: o atendimento concluído já está nas entradas. Cobranças canceladas ficam fora.";

// ---------------------------------------------------------------------------
// Entrada: o que o banco entrega
// ---------------------------------------------------------------------------

export type AtendimentoDoMes = {
  /** Início do atendimento: decide o mês, no fuso do estúdio. */
  inicio: Date;
  servico: string;
  precoCentavos: number;
};

export type LancamentoDoMes = {
  data: Date;
  tipo: string;
  descricao: string;
  categoria: string | null;
  valorCentavos: number;
  natureza: string | null;
  /** É a entrada criada ao receber uma cobrança solta. */
  deCobranca: boolean;
  /** Tipo do pagamento da Equipe que criou esta saída, quando for o caso. */
  pagamentoDaEquipe: string | null;
};

export type CobrancaParaRelatorio = {
  valorCentavos: number;
  /** "AAAA-MM-DD" */
  vencimento: string;
  situacao: string;
  /** "AAAA-MM-DD" */
  pagaEm: string | null;
  /** Cobrança criada depois do fim do mês não existia nele. */
  criadaEm: Date;
};

export type ContaParaRelatorio = {
  descricao: string;
  categoria: string | null;
  valorCentavos: number;
  /** "AAAA-MM-DD" */
  data: string;
  pago: boolean;
  /** "AAAA-MM-DD" */
  pagoEm: string | null;
};

export type DadosDoMes = {
  /** "AAAA-MM" */
  mes: string;
  /** O instante em que o relatório é montado. */
  agora: Date;
  impostoPercentual: number;
  atendimentos: AtendimentoDoMes[];
  lancamentos: LancamentoDoMes[];
  cobrancas: CobrancaParaRelatorio[];
  contas: ContaParaRelatorio[];
};

// ---------------------------------------------------------------------------
// Saída: o relatório
// ---------------------------------------------------------------------------

export type Soma = { quantidade: number; totalCentavos: number };

export type LinhaAgrupada = Soma & { rotulo: string };

export type GrupoDeNatureza =
  | "fixo"
  | "variavel"
  | "nao_operacional"
  | "retirada"
  | "sem_classificacao";

export const ROTULO_DO_GRUPO_DE_NATUREZA: Record<GrupoDeNatureza, string> = {
  fixo: `Custo ${ROTULO_DA_NATUREZA.fixo.toLowerCase()}`,
  variavel: `Custo ${ROTULO_DA_NATUREZA.variavel.toLowerCase()}`,
  nao_operacional: ROTULO_DA_NATUREZA.nao_operacional,
  retirada: "Retirada da dona",
  sem_classificacao: "Sem classificação",
};

const ORDEM_DA_NATUREZA: GrupoDeNatureza[] = [
  "fixo",
  "variavel",
  "nao_operacional",
  "retirada",
  "sem_classificacao",
];

export type ContaDoRelatorio = {
  descricao: string;
  categoria: string | null;
  dia: string;
  valorCentavos: number;
  /** paga: paga até o fim do mês; em_aberto: ainda não estava paga nele. */
  situacao: "paga" | "em_aberto";
  pagaEm: string | null;
};

export type RelatorioDoMes = {
  versao: number;
  mes: string;
  periodo: string;
  /** O mês ainda não terminou: os números podem mudar. */
  parcial: boolean;
  /**
   * O dia usado para "no fim do mês": o 1º do mês seguinte, ou hoje se o mês
   * ainda não acabou. Cobrança com vencimento antes dele estava atrasada.
   */
  referencia: string;
  impostoPercentual: number;
  entradas: {
    totalCentavos: number;
    atendimentos: Soma & { porServico: LinhaAgrupada[] };
    manuais: Soma & { porCategoria: LinhaAgrupada[] };
    cobrancasRecebidas: Soma;
  };
  saidas: Soma & {
    porCategoria: LinhaAgrupada[];
    porNatureza: (LinhaAgrupada & { grupo: GrupoDeNatureza })[];
    semCategoria: number;
  };
  /** Já está dentro das saídas: aqui só aparece separado por tipo. */
  equipe: Soma & { porTipo: LinhaAgrupada[] };
  resultado: {
    /** Entrou menos saiu. */
    resultadoCentavos: number;
    impostoEstimadoCentavos: number;
    /** O "Sobrou para você" das Finanças: depois das saídas e do imposto estimado. */
    depoisDoImpostoCentavos: number;
  };
  cobrancas: { emAberto: Soma; atrasadas: Soma };
  contasAPagar: Soma & { pagas: Soma; emAberto: Soma; itens: ContaDoRelatorio[] };
};

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

const vazio = (): Soma => ({ quantidade: 0, totalCentavos: 0 });

function somar(soma: Soma, valorCentavos: number) {
  soma.quantidade += 1;
  soma.totalCentavos += valorCentavos;
}

/** Agrupa por rótulo e ordena do maior valor para o menor; empate, por nome. */
function agrupar<T>(itens: T[], rotulo: (item: T) => string, valor: (item: T) => number) {
  const mapa = new Map<string, Soma>();
  for (const item of itens) {
    const chave = rotulo(item);
    const atual = mapa.get(chave) ?? vazio();
    somar(atual, valor(item));
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([chave, soma]) => ({ rotulo: chave, ...soma }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function nomeDaCategoria(categoria: string | null) {
  const limpa = categoria?.trim();
  return limpa ? limpa : "Sem categoria";
}

/**
 * O dia de referência do "fim do mês": o 1º do mês seguinte, ou hoje, se o mês
 * ainda não acabou. É sempre um dia de calendário, "AAAA-MM-DD".
 */
export function referenciaDoMes(mes: string, agora: Date) {
  const virada = `${somarMeses(mes, 1)}-01`;
  const hoje = paraDataLocal(agora);
  return hoje < virada ? hoje : virada;
}

/** O imposto estimado, igual ao das Finanças: percentual inteiro sobre o que entrou. */
export function impostoEstimado(entradasCentavos: number, percentual: number) {
  if (entradasCentavos <= 0 || percentual <= 0) return 0;
  // O percentual tem até duas casas (4,5%). A conta é em centésimos de ponto,
  // inteiros, para o resultado em centavos não depender de número quebrado.
  const centesimos = Math.round(percentual * 100);
  return Math.round((entradasCentavos * centesimos) / 10_000);
}

export function montarRelatorio(dados: DadosDoMes): RelatorioDoMes {
  const { mes } = dados;
  const referencia = referenciaDoMes(mes, dados.agora);
  const virada = `${somarMeses(mes, 1)}-01`;
  const parcial = referencia < virada;

  // O mês de cada linha é conferido aqui de novo, no fuso do estúdio: quem
  // chama pode ter trazido um pouco a mais, e o que fica fora não conta.
  const atendimentos = dados.atendimentos.filter((item) => competenciaAtual(item.inicio) === mes);
  const lancamentos = dados.lancamentos.filter((item) => competenciaAtual(item.data) === mes);

  // Entradas ----------------------------------------------------------------
  const atendimentosSoma = vazio();
  for (const item of atendimentos) somar(atendimentosSoma, item.precoCentavos);

  const entradasLancadas = lancamentos.filter((item) => item.tipo === "entrada");
  const manuais = entradasLancadas.filter((item) => !item.deCobranca);
  const deCobranca = entradasLancadas.filter((item) => item.deCobranca);

  const manuaisSoma = vazio();
  for (const item of manuais) somar(manuaisSoma, item.valorCentavos);
  const cobrancasRecebidas = vazio();
  for (const item of deCobranca) somar(cobrancasRecebidas, item.valorCentavos);

  const totalDeEntradas =
    atendimentosSoma.totalCentavos + manuaisSoma.totalCentavos + cobrancasRecebidas.totalCentavos;

  // Saídas ------------------------------------------------------------------
  const saidas = lancamentos.filter((item) => item.tipo === "saida");
  const saidasSoma = vazio();
  for (const item of saidas) somar(saidasSoma, item.valorCentavos);

  const porNatureza = new Map<GrupoDeNatureza, Soma>();
  for (const item of saidas) {
    // A mesma ordem da tela de Custos: retirada primeiro, depois a natureza.
    const grupo: GrupoDeNatureza = ehRetirada(item)
      ? "retirada"
      : ehNatureza(item.natureza)
        ? item.natureza
        : "sem_classificacao";
    const atual = porNatureza.get(grupo) ?? vazio();
    somar(atual, item.valorCentavos);
    porNatureza.set(grupo, atual);
  }

  const daEquipe = saidas.filter((item) => item.pagamentoDaEquipe);
  const equipeSoma = vazio();
  for (const item of daEquipe) somar(equipeSoma, item.valorCentavos);

  // Resultado ---------------------------------------------------------------
  const imposto = impostoEstimado(totalDeEntradas, dados.impostoPercentual);
  const resultadoCentavos = totalDeEntradas - saidasSoma.totalCentavos;

  // Cobranças no fim do mês ---------------------------------------------------
  // "Paga" e "criada" se comparam com a virada do mês; "atrasada", com a
  // referência. Num mês que ainda corre, a referência é hoje: o que venceu
  // antes de hoje está atrasado, igual à tela de Cobranças.
  const emAberto = vazio();
  const atrasadas = vazio();
  for (const cobranca of dados.cobrancas) {
    if (cobranca.situacao === "cancelada") continue;
    // Criada depois do mês: não existia nele.
    if (paraDataLocal(cobranca.criadaEm) >= virada) continue;
    // Paga dentro do mês (ou antes): já não estava em aberto na virada.
    const pagaAntes =
      cobranca.situacao === "paga" && cobranca.pagaEm !== null && cobranca.pagaEm < virada;
    if (pagaAntes) continue;
    if (cobranca.vencimento < referencia) somar(atrasadas, cobranca.valorCentavos);
    else somar(emAberto, cobranca.valorCentavos);
  }

  // Contas a pagar com vencimento no mês --------------------------------------
  const contasDoMes = dados.contas
    .filter((conta) => conta.data.slice(0, 7) === mes)
    .sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, "pt-BR"));
  const contasSoma = vazio();
  const pagas = vazio();
  const contasEmAberto = vazio();
  const itens: ContaDoRelatorio[] = contasDoMes.map((conta) => {
    somar(contasSoma, conta.valorCentavos);
    const paga = conta.pago && conta.pagoEm !== null && conta.pagoEm < virada;
    somar(paga ? pagas : contasEmAberto, conta.valorCentavos);
    return {
      descricao: conta.descricao,
      categoria: conta.categoria,
      dia: conta.data,
      valorCentavos: conta.valorCentavos,
      situacao: paga ? "paga" : "em_aberto",
      pagaEm: conta.pago ? conta.pagoEm : null,
    };
  });

  return {
    versao: VERSAO_DO_RELATORIO,
    mes,
    periodo: competenciaPorExtenso(mes),
    parcial,
    referencia,
    impostoPercentual: dados.impostoPercentual,
    entradas: {
      totalCentavos: totalDeEntradas,
      atendimentos: {
        ...atendimentosSoma,
        porServico: agrupar(atendimentos, (item) => item.servico, (item) => item.precoCentavos),
      },
      manuais: {
        ...manuaisSoma,
        porCategoria: agrupar(manuais, (item) => nomeDaCategoria(item.categoria), (item) => item.valorCentavos),
      },
      cobrancasRecebidas,
    },
    saidas: {
      ...saidasSoma,
      porCategoria: agrupar(saidas, (item) => nomeDaCategoria(item.categoria), (item) => item.valorCentavos),
      porNatureza: ORDEM_DA_NATUREZA.filter((grupo) => porNatureza.has(grupo)).map((grupo) => ({
        grupo,
        rotulo: ROTULO_DO_GRUPO_DE_NATUREZA[grupo],
        ...porNatureza.get(grupo)!,
      })),
      semCategoria: saidas.filter((item) => !item.categoria?.trim()).length,
    },
    equipe: {
      ...equipeSoma,
      porTipo: agrupar(
        daEquipe,
        (item) =>
          ehTipoDePagamento(item.pagamentoDaEquipe)
            ? ROTULO_DO_PAGAMENTO[item.pagamentoDaEquipe]
            : "Outro",
        (item) => item.valorCentavos,
      ),
    },
    resultado: {
      resultadoCentavos,
      impostoEstimadoCentavos: imposto,
      depoisDoImpostoCentavos: resultadoCentavos - imposto,
    },
    cobrancas: { emAberto, atrasadas },
    contasAPagar: { ...contasSoma, pagas, emAberto: contasEmAberto, itens },
  };
}

// ---------------------------------------------------------------------------
// Pendências antes de fechar
// ---------------------------------------------------------------------------

export type Pendencia = {
  chave: "cobrancas-atrasadas" | "contas-em-aberto" | "despesas-sem-categoria" | "sem-classificacao";
  titulo: string;
  explicacao: string;
  quantidade: number;
  totalCentavos: number | null;
  link: string;
};

/**
 * O que olhar antes de fechar. Nenhuma pendência impede o fechamento: são
 * avisos para a dona decidir, como o contador pediria.
 */
export function pendenciasDoRelatorio(relatorio: RelatorioDoMes): Pendencia[] {
  const semClassificacao = relatorio.saidas.porNatureza.find(
    (linha) => linha.grupo === "sem_classificacao",
  );
  return [
    {
      chave: "cobrancas-atrasadas",
      titulo: "Cobranças atrasadas",
      explicacao: "Venceram e não foram marcadas como pagas. Se o cliente já pagou, marque antes de fechar.",
      quantidade: relatorio.cobrancas.atrasadas.quantidade,
      totalCentavos: relatorio.cobrancas.atrasadas.totalCentavos,
      link: "/painel/cobrancas",
    },
    {
      chave: "contas-em-aberto",
      titulo: "Contas do mês sem pagamento marcado",
      explicacao: "Se já pagou, marque o pagamento: ele vira saída do mês.",
      quantidade: relatorio.contasAPagar.emAberto.quantidade,
      totalCentavos: relatorio.contasAPagar.emAberto.totalCentavos,
      link: "/painel/vencimentos",
    },
    {
      chave: "despesas-sem-categoria",
      titulo: "Despesas sem categoria",
      explicacao: "Sem categoria, o contador não sabe onde encaixar o valor.",
      quantidade: relatorio.saidas.semCategoria,
      totalCentavos: null,
      link: "/painel/financas",
    },
    {
      chave: "sem-classificacao",
      titulo: "Despesas sem fixo ou variável",
      explicacao: "Só muda a visão de custos. Dá para classificar mesmo com o mês fechado.",
      quantidade: semClassificacao?.quantidade ?? 0,
      totalCentavos: semClassificacao?.totalCentavos ?? null,
      link: `/painel/financas/custos?mes=${relatorio.mes}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Resumo congelado
// ---------------------------------------------------------------------------

/**
 * Lê o resumo guardado no fechamento. Devolve null se ele não tiver a forma
 * esperada (versão antiga ou dado mexido), e quem chama monta o relatório ao
 * vivo em vez de mostrar números quebrados.
 */
export function lerResumoGuardado(valor: unknown): RelatorioDoMes | null {
  if (!valor || typeof valor !== "object") return null;
  const resumo = valor as Partial<RelatorioDoMes>;
  if (resumo.versao !== VERSAO_DO_RELATORIO) return null;
  if (typeof resumo.mes !== "string" || !resumo.entradas || !resumo.saidas || !resumo.resultado) {
    return null;
  }
  return resumo as RelatorioDoMes;
}
