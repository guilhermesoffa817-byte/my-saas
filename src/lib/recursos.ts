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
  | "financas";

const SO_NO_VIP: Record<Recurso, boolean> = {
  /** Cobrar pelo WhatsApp é dos dois planos: é o que traz dinheiro para o estúdio. */
  cobrar: false,
  lembretes: true,
  vencimentos: true,
  documentos: true,
  financas: true,
};

/** Quantas leituras de documento o plano dá por mês. */
export const LEITURAS_POR_MES_NO_VIP = 30;

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
