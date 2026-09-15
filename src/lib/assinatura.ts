import { somarDias } from "@/lib/formato";

export const DIAS_DE_TESTE = 7;
export const DIAS_POR_CICLO = 30;

export const PLANO = {
  nome: "Plano Estúdio",
  valorCentavos: Number(process.env.ASSINATURA_VALOR_CENTAVOS ?? 26000),
  pixChave: process.env.PIX_CHAVE ?? "66992513501",
  pixNome: process.env.PIX_NOME ?? "Estúdio de Estética",
};

export type StatusAssinatura = "teste" | "aguardando" | "ativa" | "expirada";

export type AssinaturaResumo = {
  status: string;
  validaAte: Date;
};

export type SituacaoAssinatura = {
  status: StatusAssinatura;
  liberada: boolean;
  emTeste: boolean;
  diasRestantes: number;
  validaAte: Date;
  recado: string;
};

export function avaliarAssinatura(
  assinatura: AssinaturaResumo | null | undefined,
  agora = new Date(),
): SituacaoAssinatura {
  if (!assinatura) {
    return {
      status: "expirada",
      liberada: false,
      emTeste: false,
      diasRestantes: 0,
      validaAte: agora,
      recado: "Ative sua assinatura para continuar usando o painel.",
    };
  }

  const validaAte = assinatura.validaAte;
  const dentroDoPrazo = validaAte.getTime() > agora.getTime();
  const diasRestantes = Math.max(
    0,
    Math.ceil((validaAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const status: StatusAssinatura = dentroDoPrazo
    ? (assinatura.status as StatusAssinatura)
    : "expirada";

  const emTeste = status === "teste" && dentroDoPrazo;
  const liberada = dentroDoPrazo && (status === "ativa" || status === "teste");

  return {
    status,
    liberada,
    emTeste,
    diasRestantes,
    validaAte,
    recado: montarRecado(status, dentroDoPrazo, diasRestantes),
  };
}

function montarRecado(
  status: StatusAssinatura,
  dentroDoPrazo: boolean,
  diasRestantes: number,
) {
  if (status === "teste" && dentroDoPrazo) {
    return diasRestantes === 1
      ? "Seu período de teste termina amanhã. Que tal já garantir o próximo mês?"
      : `Você está no período de teste: faltam ${diasRestantes} dias para ele acabar.`;
  }

  if (status === "ativa" && dentroDoPrazo) {
    return diasRestantes <= 5
      ? `Sua assinatura está em dia e renova em ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}.`
      : "Sua assinatura está em dia. Obrigado por confiar na gente!";
  }

  if (status === "aguardando") {
    return "Recebemos o aviso do seu Pix. Estamos conferindo e já liberamos tudo, viu?";
  }

  return "Sua assinatura venceu. Faça o Pix para voltar a usar o painel quando quiser.";
}

/** Nova validade ao confirmar um pagamento: soma 30 dias sem perder os dias que sobraram. */
export function novaValidade(validaAte: Date | null, agora = new Date()) {
  const base =
    validaAte && validaAte.getTime() > agora.getTime() ? validaAte : agora;
  return somarDias(base, DIAS_POR_CICLO);
}

/**
 * Monta o payload "copia e cola" do Pix (BR Code estático, padrão do Banco Central).
 */
export function pixCopiaECola({
  chave,
  nome,
  cidade = "SAO PAULO",
  valorCentavos,
  identificador = "ASSINATURA",
}: {
  chave: string;
  nome: string;
  cidade?: string;
  valorCentavos: number;
  identificador?: string;
}) {
  const campo = (id: string, valor: string) =>
    `${id}${String(valor.length).padStart(2, "0")}${valor}`;

  const semAcento = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .toUpperCase()
      .trim();

  const merchant =
    campo("00", "br.gov.bcb.pix") + campo("01", chave);

  const payload =
    campo("00", "01") +
    campo("26", merchant) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", semAcento(nome).slice(0, 25) || "ESTUDIO") +
    campo("60", semAcento(cidade).slice(0, 15) || "SAO PAULO") +
    campo("62", campo("05", semAcento(identificador).slice(0, 25) || "***")) +
    "6304";

  return payload + crc16(payload);
}

function crc16(texto: string) {
  let resultado = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    resultado ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      resultado =
        (resultado & 0x8000) !== 0
          ? ((resultado << 1) ^ 0x1021) & 0xffff
          : (resultado << 1) & 0xffff;
    }
  }
  return resultado.toString(16).toUpperCase().padStart(4, "0");
}
