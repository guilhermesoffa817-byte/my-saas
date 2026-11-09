import {
  NOME_DA_FAMILIA,
  temPlanoAoMenos,
  type AssinaturaParaPlano,
  type FamiliaDoPlano,
} from "@/lib/assinatura";

/**
 * Quem pode usar o quê, num lugar só.
 *
 * Cada recurso diz o plano mais barato que o libera. Os planos se somam: o Pro
 * tem tudo do Normal, e o VIP tem tudo do Pro. Quem decide se a conta tem
 * acesso ao painel é guardas.ts; aqui só se decide até onde ela vai.
 *
 * Mudar um recurso de plano é mudar uma linha aqui. A página de vendas e a tela
 * de assinatura leem esta tabela pelo teste de itens-dos-planos.ts, que quebra
 * se o texto de um plano prometer algo que só um plano maior libera.
 */
export type Recurso =
  | "cobrar"
  | "lembretes"
  | "vencimentos"
  | "documentos"
  | "financas"
  | "relatorio"
  | "equipe"
  | "custos"
  | "assistente";

const PLANO_MINIMO: Record<Recurso, FamiliaDoPlano> = {
  /** Cobrar pelo WhatsApp com o Pix pronto é de todos: é o que traz dinheiro para o estúdio. */
  cobrar: "normal",
  /** Finanças (entradas, saídas, resumo do mês e imposto estimado): o Normal é agenda + finanças. */
  financas: "normal",
  /** Leitura de contrato e recibo pela IA: é o que o Pro vende. */
  documentos: "pro",
  /** Contas a pagar e prazos de contrato andam junto com a leitura dos papéis. */
  vencimentos: "pro",
  /** Custos operacionais usa classificação por IA e o ponto de equilíbrio. */
  custos: "pro",
  /** Relatório do mês, fechamento e link do contador. */
  relatorio: "pro",
  /**
   * Lembretes de cobrança: o Bossa diz todo dia quem cobrar, com a mensagem e o
   * Pix prontos. É a cobrança no piloto do VIP. Ainda não manda sozinho: quem
   * aperta enviar no WhatsApp é a dona.
   */
  lembretes: "vip",
  /** Equipe é de quem já tem gente trabalhando junto, inclusive "quem atende" na agenda e no link. */
  equipe: "vip",
  /** O assistente lê o financeiro e tem custo por pergunta. */
  assistente: "vip",
};

/** Quantas leituras de documento o Pro e o VIP dão por mês. */
export const LEITURAS_POR_MES = 30;

/**
 * Franquia mensal de inteligência artificial, por recurso.
 *
 * [EXEMPLO] Os números abaixo são um ponto de partida, não um
 * cálculo de custo: ajuste depois de ver o uso real na tabela UsoDeIa, que
 * guarda os tokens de cada chamada. Classificação conta 1 por despesa enviada à
 * IA (as regras automáticas não contam); o assistente conta 1 por pergunta.
 */
export const CLASSIFICACOES_POR_MES = 300; // [EXEMPLO]
export const PERGUNTAS_POR_MES = 60; // [EXEMPLO]

export type RecursoDeIa = "classificacao" | "assistente" | "leitura";

type ComAssinatura = { assinatura?: AssinaturaParaPlano | null };

export function limiteDeIa(usuario: ComAssinatura, recurso: RecursoDeIa, agora = new Date()) {
  const dono: Recurso =
    recurso === "classificacao" ? "custos" : recurso === "assistente" ? "assistente" : "documentos";
  if (!temPlanoAoMenos(usuario.assinatura, PLANO_MINIMO[dono], agora)) return 0;
  if (recurso === "classificacao") return CLASSIFICACOES_POR_MES;
  if (recurso === "assistente") return PERGUNTAS_POR_MES;
  return LEITURAS_POR_MES;
}

/** Todos os recursos, na ordem da tabela. Serve para conferir listas que dependem dela. */
export const RECURSOS = Object.keys(PLANO_MINIMO) as Recurso[];

/** O plano mais barato que libera o recurso. A tela de planos e o teste dela leem daqui. */
export function planoMinimo(recurso: Recurso): FamiliaDoPlano {
  return PLANO_MINIMO[recurso];
}

/** Se o recurso precisa de um plano acima do Normal. */
export function precisaDePlanoMaior(recurso: Recurso) {
  return PLANO_MINIMO[recurso] !== "normal";
}

/** "Pro" ou "VIP": a etiqueta que aparece ao lado do recurso. Null quando o Normal já libera. */
export function etiquetaDoPlano(recurso: Recurso) {
  return precisaDePlanoMaior(recurso) ? NOME_DA_FAMILIA[PLANO_MINIMO[recurso]] : null;
}

/** O endereço da tela de planos já abrindo no plano que libera o recurso. */
export function linkDoPlanoQueLibera(recurso: Recurso) {
  return `/painel/assinatura?plano=${PLANO_MINIMO[recurso]}`;
}

/**
 * Se o recurso está ligado neste servidor.
 *
 * A leitura de documentos e o assistente dependem de serviços pagos por uso (a
 * IA da Anthropic) e de chaves que só existem no ambiente da hospedagem. Sem
 * elas, o recurso some do menu, da página de vendas e da tela de planos, para o
 * Bossa nunca vender o que não está funcionando. Quando a chave entra, ele
 * aparece sozinho no próximo deploy (a página de vendas é montada no build).
 */
export function recursoLigado(recurso: Recurso) {
  const temIa = Boolean(process.env.ANTHROPIC_API_KEY);
  if (recurso === "assistente") return temIa;
  if (recurso === "documentos") {
    return temIa && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return true;
}

/** Os recursos ligados neste servidor, para a demonstração mostrar só o que existe de verdade. */
export function recursosLigados(): Recurso[] {
  return RECURSOS.filter(recursoLigado);
}

export function podeUsar(usuario: ComAssinatura, recurso: Recurso, agora = new Date()) {
  if (!recursoLigado(recurso)) return false;
  if (PLANO_MINIMO[recurso] === "normal") return true;
  return temPlanoAoMenos(usuario.assinatura, PLANO_MINIMO[recurso], agora);
}

/** Os recursos que a conta pode usar agora. A navegação mostra só as abas destes. */
export function recursosLiberados(usuario: ComAssinatura, agora = new Date()): Recurso[] {
  return RECURSOS.filter((recurso) => podeUsar(usuario, recurso, agora));
}
