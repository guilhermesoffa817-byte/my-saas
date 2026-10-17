import { temPlanoCompleto, type AssinaturaParaPlano } from "@/lib/assinatura";

/**
 * Quem pode usar o quê, num lugar só.
 *
 * Cada recurso diz se é só do plano Completo. O que não é do Completo vale para
 * qualquer conta com acesso ao painel (Simples, Completo ou o teste antigo que
 * ainda está valendo): quem decide se a conta tem acesso é guardas.ts.
 *
 * Mudar um recurso de plano é mudar uma linha aqui. A página de vendas e a tela
 * de assinatura leem esta tabela pelo teste de itens-dos-planos.ts, que quebra
 * se o texto prometer no Simples algo que só o Completo libera.
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

const SO_NO_COMPLETO: Record<Recurso, boolean> = {
  /** Cobrar pelo WhatsApp é dos dois planos: é o que traz dinheiro para o estúdio. */
  cobrar: false,
  lembretes: true,
  vencimentos: true,
  documentos: true,
  /**
   * Finanças (entradas, saídas, resumo do mês e imposto estimado) passou para
   * o Simples: quem cobra pelo WhatsApp precisa ver o que entrou.
   */
  financas: false,
  /** Relatório do mês, fechamento e link do contador: é o pacote de quem tem contador. */
  relatorio: true,
  /** Equipe é de quem já tem gente trabalhando junto, inclusive "quem atende" na agenda e no link. */
  equipe: true,
  /** Custos operacionais usa classificação por IA e o ponto de equilíbrio. */
  custos: true,
  /** O assistente lê o financeiro e tem custo por pergunta. */
  assistente: true,
};

/** Quantas leituras de documento o Completo dá por mês. */
export const LEITURAS_POR_MES_NO_COMPLETO = 30;

/**
 * Franquia mensal de inteligência artificial, por recurso.
 *
 * [EXEMPLO] Os números abaixo são um ponto de partida para o Completo, não um
 * cálculo de custo: ajuste depois de ver o uso real na tabela UsoDeIa, que
 * guarda os tokens de cada chamada. Classificação conta 1 por despesa enviada à
 * IA (as regras automáticas não contam); o assistente conta 1 por pergunta.
 */
export const CLASSIFICACOES_POR_MES_NO_COMPLETO = 300; // [EXEMPLO]
export const PERGUNTAS_POR_MES_NO_COMPLETO = 60; // [EXEMPLO]

export type RecursoDeIa = "classificacao" | "assistente" | "leitura";

type ComAssinatura = { assinatura?: AssinaturaParaPlano | null };

export function limiteDeIa(usuario: ComAssinatura, recurso: RecursoDeIa, agora = new Date()) {
  if (!temPlanoCompleto(usuario.assinatura, agora)) return 0;
  if (recurso === "classificacao") return CLASSIFICACOES_POR_MES_NO_COMPLETO;
  if (recurso === "assistente") return PERGUNTAS_POR_MES_NO_COMPLETO;
  return LEITURAS_POR_MES_NO_COMPLETO;
}

/** Todos os recursos, na ordem da tabela. Serve para conferir listas que dependem dela. */
export const RECURSOS = Object.keys(SO_NO_COMPLETO) as Recurso[];

/** Se o recurso é só do Completo. A tela de planos e o teste dela leem daqui. */
export function soNoCompleto(recurso: Recurso) {
  return SO_NO_COMPLETO[recurso];
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
  if (!SO_NO_COMPLETO[recurso]) return true;
  return temPlanoCompleto(usuario.assinatura, agora);
}

/** Os recursos que a conta pode usar agora. A navegação mostra só as abas destes. */
export function recursosLiberados(usuario: ComAssinatura, agora = new Date()): Recurso[] {
  return RECURSOS.filter((recurso) => podeUsar(usuario, recurso, agora));
}
