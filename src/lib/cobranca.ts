/**
 * As regras da cobrança que não dependem do banco nem da tela.
 *
 * Tudo aqui é função pura, para poder ser testado sem subir nada: a situação
 * que a cobrança mostra, qual lembrete cabe hoje e o texto da mensagem.
 */

import {
  dataPuraCurta,
  diferencaEmDias,
  emReais,
  paraDataPura,
  primeiroNome,
  somarDiasPuros,
} from "@/lib/formato";

/** O que fica gravado no banco. "Atrasada" não entra: ela se calcula pela data. */
export type SituacaoGravada = "aberta" | "paga" | "cancelada";

/** O que a pessoa vê na tela. */
export type SituacaoNaTela = "aberta" | "atrasada" | "paga" | "cancelada";

export function situacaoDaCobranca(
  cobranca: { situacao: string; vencimento: Date },
  hoje: Date,
): SituacaoNaTela {
  if (cobranca.situacao === "paga") return "paga";
  if (cobranca.situacao === "cancelada") return "cancelada";
  return diferencaEmDias(hoje, cobranca.vencimento) < 0 ? "atrasada" : "aberta";
}

/** Uma linha curta explicando o prazo, do jeito que a pessoa fala. */
export function prazoPorExtenso(vencimento: Date, hoje: Date) {
  const dias = diferencaEmDias(hoje, vencimento);
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  if (dias > 1) return `Vence em ${dias} dias`;
  if (dias === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(dias)} dias`;
}

/* ------------------------------------------------------------------ */
/* Lembretes                                                           */
/* ------------------------------------------------------------------ */

export type CodigoDoMomento = "antes" | "no_dia" | "tres_dias" | "sete_dias";

/**
 * Quando o Bossa sugere lembrar. Os dias são contados a partir do vencimento:
 * negativo é antes, positivo é depois. Cada estúdio liga e desliga o que quiser.
 */
export const MOMENTOS: {
  codigo: CodigoDoMomento;
  dias: number;
  rotulo: string;
  tomSugerido: Tom;
}[] = [
  { codigo: "antes", dias: -1, rotulo: "Um dia antes", tomSugerido: "gentil" },
  { codigo: "no_dia", dias: 0, rotulo: "No dia do vencimento", tomSugerido: "gentil" },
  { codigo: "tres_dias", dias: 3, rotulo: "Três dias depois", tomSugerido: "direto" },
  { codigo: "sete_dias", dias: 7, rotulo: "Sete dias depois", tomSugerido: "firme" },
];

export type PreferenciaDeLembrete = Record<CodigoDoMomento, boolean>;

export const LEMBRETES_PADRAO: PreferenciaDeLembrete = {
  antes: true,
  no_dia: true,
  tres_dias: true,
  sete_dias: true,
};

/**
 * Quais momentos já chegaram a hora para esta cobrança e ainda não foram
 * enviados. Devolve do mais antigo para o mais recente.
 *
 * Nenhuma tarefa agendada roda por trás: isto é calculado na hora em que a
 * tela abre, a partir das datas.
 */
export function momentosPendentes({
  vencimento,
  hoje,
  preferencias,
  jaEnviados,
}: {
  vencimento: Date;
  hoje: Date;
  preferencias: PreferenciaDeLembrete;
  jaEnviados: CodigoDoMomento[];
}) {
  return MOMENTOS.filter((momento) => {
    if (!preferencias[momento.codigo]) return false;
    if (jaEnviados.includes(momento.codigo)) return false;
    const dia = somarDiasPuros(vencimento, momento.dias);
    return diferencaEmDias(hoje, dia) <= 0;
  });
}

/**
 * O lembrete que cabe hoje, ou nada.
 *
 * Quando mais de um momento passou sem envio, vale o mais recente: a cobrança
 * aparece uma vez só, com o tom que combina com o atraso de verdade, e não com
 * o primeiro aviso que ficou para trás.
 */
export function lembreteDeHoje(entrada: {
  vencimento: Date;
  hoje: Date;
  preferencias: PreferenciaDeLembrete;
  jaEnviados: CodigoDoMomento[];
}) {
  const pendentes = momentosPendentes(entrada);
  if (pendentes.length === 0) return null;
  const escolhido = pendentes[pendentes.length - 1];
  return {
    momento: escolhido,
    /**
     * Ao registrar o envio, todos os pendentes até aqui são dados por
     * cobertos. Sem isso, a mesma cobrança voltaria amanhã pedindo um aviso
     * mais brando do que o que já foi mandado.
     */
    cobre: pendentes.map((item) => item.codigo),
  };
}

/* ------------------------------------------------------------------ */
/* Mensagem                                                            */
/* ------------------------------------------------------------------ */

export type Tom = "gentil" | "direto" | "firme";

export const TONS: { codigo: Tom; rotulo: string; explicacao: string }[] = [
  {
    codigo: "gentil",
    rotulo: "Gentil",
    explicacao: "Para o primeiro aviso, antes de vencer.",
  },
  {
    codigo: "direto",
    rotulo: "Direto",
    explicacao: "Para quando já passou da data.",
  },
  {
    codigo: "firme",
    rotulo: "Firme",
    explicacao: "Para quando o atraso já é grande. Educado do mesmo jeito.",
  },
];

export type DadosDaMensagem = {
  tom: Tom;
  nomeDoCliente: string;
  nomeDoEstudio: string;
  valorCentavos: number;
  vencimento: Date;
  hoje: Date;
  /** O "copia e cola" do Pix, quando o estúdio tiver chave cadastrada. */
  codigoPix?: string | null;
};

/**
 * O texto que vai para o WhatsApp.
 *
 * Nome, valor, data e código Pix são preenchidos aqui, pelo sistema, a partir
 * dos dados da cobrança. Nenhum deles passa por inteligência artificial: um
 * valor inventado numa mensagem de cobrança é dinheiro cobrado errado de um
 * cliente de verdade.
 *
 * Os três tons são educados. Nenhum ameaça, nenhum constrange e nenhum conta a
 * dívida para mais ninguém: além de ser o que o Código de Defesa do Consumidor
 * exige, é o cliente do estúdio que está do outro lado, e ele precisa voltar.
 */
export function montarMensagem({
  tom,
  nomeDoCliente,
  nomeDoEstudio,
  valorCentavos,
  vencimento,
  hoje,
  codigoPix,
}: DadosDaMensagem) {
  const nome = primeiroNome(nomeDoCliente);
  const valor = emReais(valorCentavos);
  const data = dataPuraCurta(vencimento);
  const atrasoEmDias = -diferencaEmDias(hoje, vencimento);

  const corpo = {
    gentil:
      atrasoEmDias > 0
        ? `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. Passando para lembrar do seu atendimento: ${valor}, com vencimento em ${data}. Se já tiver pago, pode ignorar esta mensagem.`
        : `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. Passando para lembrar do seu atendimento: ${valor}, com vencimento em ${data}.`,
    direto: `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. O seu atendimento de ${valor} venceu em ${data} e ainda consta em aberto por aqui. Consegue acertar hoje?`,
    firme: `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. O seu atendimento de ${valor}, com vencimento em ${data}, segue em aberto. Pode me dizer qual a melhor data para você acertar? Assim eu já me organizo por aqui.`,
  }[tom];

  const fecho = "Qualquer dúvida, é só chamar.";
  const pix = codigoPix
    ? `\n\nPara pagar por Pix, é só copiar o código abaixo:\n${codigoPix}`
    : "";

  return `${corpo} ${fecho}${pix}`;
}

/** O que vai no extrato de quem paga. */
export function identificadorDoPix(vencimento: Date) {
  return `ATENDIMENTO ${paraDataPura(vencimento).replace(/-/g, "")}`;
}
