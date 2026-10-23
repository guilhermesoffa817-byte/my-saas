/**
 * Quanto vale um atendimento no faturamento.
 *
 * É o preço guardado no próprio horário: o do serviço quando ele foi marcado,
 * ou o valor recebido quando a cobrança dele foi paga com outro valor. Nunca o
 * preço de hoje do serviço, que mudaria o faturamento de meses já vividos.
 *
 * O preço do serviço só entra como reserva para horário sem preço guardado, o
 * que o gatilho do banco já impede (migração 20261019100000_preco_do_atendimento).
 */
export function precoDoAtendimento(atendimento: {
  precoCentavos: number | null;
  servico: { precoCentavos: number };
}) {
  return atendimento.precoCentavos ?? atendimento.servico.precoCentavos;
}
