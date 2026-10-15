/**
 * As regras da agenda que não dependem do banco nem da tela.
 *
 * Ficam aqui, separadas das ações, para poder ser testadas sem subir nada e
 * para que a ação de marcar e a de remarcar façam exatamente a mesma conta.
 */

import type { SituacaoDoAtendimento } from "@/lib/atendimento";

const MINUTO = 60 * 1000;

/** Dois horários se sobrepõem quando um começa antes de o outro terminar. */
export function seSobrepoem(
  a: { inicio: Date; duracaoMin: number },
  b: { inicio: Date; duracaoMin: number },
) {
  const fimDeA = a.inicio.getTime() + a.duracaoMin * MINUTO;
  const fimDeB = b.inicio.getTime() + b.duracaoMin * MINUTO;
  // Encostar não é esbarrar: um termina às 10h e o outro começa às 10h.
  return a.inicio.getTime() < fimDeB && b.inicio.getTime() < fimDeA;
}

/**
 * Quais trocas de situação fazem sentido.
 *
 * Falta e cancelamento só valem para quem ainda está agendado: não dá para
 * faltar num atendimento que já aconteceu. Voltar para agendado vale sempre,
 * porque é o desfazer de um toque errado. Concluir vale de qualquer lugar,
 * porque o cliente marcado como falta pode ter chegado atrasado.
 */
export function podeMudarDeSituacao(de: string, para: SituacaoDoAtendimento) {
  if (de === para) return false;
  if (para === "agendado" || para === "concluido") return true;
  return de === "agendado";
}

/**
 * O valor do atendimento depois de remarcado.
 *
 * Mudar só o dia ou a hora não muda o combinado: o valor continua o mesmo,
 * mesmo que o preço do serviço tenha subido desde então. Trocar o serviço é
 * outro combinado, e o valor passa a ser o preço atual do serviço novo.
 */
export function valorAoRemarcar(
  atual: { servicoId: string; valorCentavos: number | null },
  novoServico: { id: string; precoCentavos: number },
) {
  return novoServico.id === atual.servicoId
    ? atual.valorCentavos
    : novoServico.precoCentavos;
}

export type ChamadaDeHoje<T> =
  | { tipo: "primeiro"; atendimento: T }
  | { tipo: "proximo"; atendimento: T }
  | { tipo: "todos_comecaram" };

/**
 * O que dizer sobre os atendimentos de hoje que ainda estão agendados.
 *
 * Antes do primeiro, vale dizer quem abre o dia. Depois dele, o que importa é
 * quem vem a seguir, e não quem já passou. Quando todos já começaram, sobra só
 * marcar na agenda como cada um terminou.
 */
export function chamadaDeHoje<T extends { inicio: Date }>(
  agendados: T[],
  agora: Date,
): ChamadaDeHoje<T> | null {
  if (agendados.length === 0) return null;

  const emOrdem = [...agendados].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const proximo = emOrdem.find((item) => item.inicio.getTime() > agora.getTime());

  if (!proximo) return { tipo: "todos_comecaram" };
  if (proximo === emOrdem[0]) return { tipo: "primeiro", atendimento: proximo };
  return { tipo: "proximo", atendimento: proximo };
}
