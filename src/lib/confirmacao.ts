/**
 * A mensagem que confirma o horário com o cliente pelo WhatsApp.
 *
 * Falta é horário perdido que não volta. Uma mensagem na véspera, com o dia, a
 * hora e o serviço escritos certinho, dá ao cliente a chance de avisar antes, e
 * ao estúdio a chance de encaixar outra pessoa no lugar.
 *
 * Tudo aqui é montado pelo sistema a partir do horário marcado, no fuso do
 * estúdio. O link só abre o WhatsApp com o texto pronto: quem envia é a pessoa,
 * e por isso é ela quem conta depois que mandou.
 */

import {
  diaDaSemana,
  diferencaEmDias,
  hojeNoEstudio,
  hora,
  paraDataLocal,
  primeiroNome,
} from "@/lib/formato";

/** "15/10", no fuso do estúdio. O ano sobra numa mensagem sobre esta semana. */
function diaEMes(data: Date) {
  const [, mes, dia] = paraDataLocal(data).split("-");
  return `${dia}/${mes}`;
}

/**
 * O dia do horário do jeito que se fala: "amanhã, quinta-feira (15/10)".
 * Hoje e amanhã ganham a palavra na frente, que é o que o cliente lê primeiro.
 */
export function quandoPorExtenso(inicio: Date, agora: Date) {
  const dia = `${diaDaSemana(inicio)} (${diaEMes(inicio)})`;
  const distancia = diferencaEmDias(hojeNoEstudio(agora), hojeNoEstudio(inicio));
  if (distancia === 0) return `hoje, ${dia}`;
  if (distancia === 1) return `amanhã, ${dia}`;
  return dia;
}

export type DadosDaConfirmacao = {
  nomeDoCliente: string;
  nomeDoEstudio: string;
  nomeDoServico: string;
  inicio: Date;
  /** O instante de agora, para dizer "hoje" ou "amanhã" em vez da data seca. */
  agora: Date;
};

export function mensagemDeConfirmacao({
  nomeDoCliente,
  nomeDoEstudio,
  nomeDoServico,
  inicio,
  agora,
}: DadosDaConfirmacao) {
  const nome = primeiroNome(nomeDoCliente);
  const quando = quandoPorExtenso(inicio, agora);

  return `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. Passando para confirmar o seu horário de ${nomeDoServico}: ${quando}, às ${hora(inicio)}. Você confirma? É só responder por aqui.`;
}

/**
 * A lista da véspera: quem ainda falta confirmar vem primeiro, na ordem do
 * dia, e quem já recebeu a mensagem desce para o fim, para não ocupar o topo
 * com o que já está resolvido.
 */
export function ordenarParaConfirmar<
  T extends { inicio: Date; confirmacaoEnviadaEm: Date | null },
>(lista: T[]) {
  return [...lista].sort((a, b) => {
    const enviadaA = a.confirmacaoEnviadaEm ? 1 : 0;
    const enviadaB = b.confirmacaoEnviadaEm ? 1 : 0;
    if (enviadaA !== enviadaB) return enviadaA - enviadaB;
    return a.inicio.getTime() - b.inicio.getTime();
  });
}
