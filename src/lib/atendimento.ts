/**
 * Regras de um atendimento da agenda que valem em mais de uma tela.
 *
 * O valor de um atendimento é o combinado na hora de marcar, guardado no próprio
 * horário. Assim, subir o preço de um serviço vale para os próximos horários e
 * não reescreve o faturamento dos meses que já passaram.
 */

export const SITUACOES_DO_ATENDIMENTO = [
  "agendado",
  "concluido",
  "faltou",
  "cancelado",
] as const;

export type SituacaoDoAtendimento = (typeof SITUACOES_DO_ATENDIMENTO)[number];

export const ROTULO_DA_SITUACAO: Record<SituacaoDoAtendimento, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

export function situacaoValida(valor: unknown): valor is SituacaoDoAtendimento {
  return (
    typeof valor === "string" &&
    (SITUACOES_DO_ATENDIMENTO as readonly string[]).includes(valor)
  );
}

/** Situações que ocupam o horário na agenda. Falta e cancelamento liberam. */
export const SITUACOES_QUE_OCUPAM: SituacaoDoAtendimento[] = ["agendado", "concluido"];

/**
 * Quanto vale o atendimento. Horários marcados antes de o valor ser guardado
 * caem no preço atual do serviço, que era o que o sistema mostrava até então.
 */
export function valorDoAtendimento(atendimento: {
  valorCentavos: number | null;
  servico: { precoCentavos: number };
}) {
  return atendimento.valorCentavos ?? atendimento.servico.precoCentavos;
}
