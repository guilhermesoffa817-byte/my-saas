import { temFinanceiro } from "@/lib/assinatura";

/**
 * Quem pode usar o quê, num lugar só.
 *
 * A regra de plano estava espalhada: a aba Finanças tinha a dela em guardas.ts,
 * e cada tela nova traria a sua. Aqui fica a tabela inteira, de forma que mudar
 * um recurso de plano seja mudar uma linha, e não caçar pelo projeto.
 *
 * A liberação continua a mesma que já existia: `temFinanceiro` olha se a
 * assinatura é VIP, está ativa e dentro do prazo.
 */
export type Recurso =
  | "cobrar"
  | "lembretes"
  | "vencimentos"
  | "documentos"
  | "financas"
  | "equipe"
  | "custos";

const SO_NO_VIP: Record<Recurso, boolean> = {
  /** Cobrar pelo WhatsApp é dos dois planos: é o que traz dinheiro para o estúdio. */
  cobrar: false,
  lembretes: true,
  vencimentos: true,
  documentos: true,
  financas: true,
  /** Equipe é de quem já tem gente trabalhando junto: cabe no VIP. */
  equipe: true,
  /** Custos operacionais mora dentro de Finanças, que já é do VIP. */
  custos: true,
};

/** Quantas leituras de documento o plano dá por mês. */
export const LEITURAS_POR_MES_NO_VIP = 30;

/**
 * Franquia mensal de inteligência artificial, por recurso.
 *
 * [EXEMPLO] Os números abaixo são um ponto de partida para o plano VIP, não um
 * cálculo de custo: ajuste depois de ver o uso real na tabela UsoDeIa, que
 * guarda os tokens de cada chamada. Classificação conta 1 por despesa enviada à
 * IA (as regras automáticas não contam); o assistente conta 1 por pergunta.
 */
export const CLASSIFICACOES_POR_MES_NO_VIP = 300; // [EXEMPLO]
export const PERGUNTAS_POR_MES_NO_VIP = 60; // [EXEMPLO]

export type RecursoDeIa = "classificacao" | "assistente" | "leitura";

export function limiteDeIa(
  usuario: { assinatura?: { status: string; plano: string; validaAte: Date } | null },
  recurso: RecursoDeIa,
  agora = new Date(),
) {
  if (!temFinanceiro(usuario.assinatura, agora)) return 0;
  if (recurso === "classificacao") return CLASSIFICACOES_POR_MES_NO_VIP;
  if (recurso === "assistente") return PERGUNTAS_POR_MES_NO_VIP;
  return LEITURAS_POR_MES_NO_VIP;
}

export function podeUsar(
  usuario: { assinatura?: { status: string; plano: string; validaAte: Date } | null },
  recurso: Recurso,
  agora = new Date(),
) {
  if (!SO_NO_VIP[recurso]) return true;
  return temFinanceiro(usuario.assinatura, agora);
}

export function leiturasDoPlano(usuario: {
  assinatura?: { status: string; plano: string; validaAte: Date } | null;
}) {
  return temFinanceiro(usuario.assinatura) ? LEITURAS_POR_MES_NO_VIP : 0;
}
