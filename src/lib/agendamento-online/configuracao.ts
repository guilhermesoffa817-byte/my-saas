/**
 * Regras da configuração do agendamento online: o endereço do link, os
 * horários de atendimento e o telefone de quem marca. Só conta, sem banco.
 */
import { apenasDigitos } from "@/lib/formato";
import { horaParaMinutos, MINUTOS_NO_DIA, minutosParaHora, type Faixa } from "./disponibilidade";

export const LINK_MINIMO = 3;
export const LINK_MAXIMO = 40;

/** Letras minúsculas sem acento, números e hífen no meio, nunca nas pontas. */
const FORMATO_DO_LINK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function linkValido(link: string) {
  return (
    link.length >= LINK_MINIMO && link.length <= LINK_MAXIMO && FORMATO_DO_LINK.test(link)
  );
}

/**
 * Transforma o nome do negócio num endereço: "Estúdio Bela Pele" vira
 * "estudio-bela-pele". Acento sai, espaço e símbolo viram hífen.
 */
export function sugerirLink(nomeDoNegocio: string) {
  const base = nomeDoNegocio
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LINK_MAXIMO)
    .replace(/-+$/g, "");
  return base.length >= LINK_MINIMO ? base : `agenda-${base || "estudio"}`.slice(0, LINK_MAXIMO);
}

/** Limpa o que a pessoa digitou no campo do link, sem inventar nada. */
export function limparLink(texto: string) {
  return texto.trim().toLowerCase();
}

/** As opções de antecedência mínima, em minutos. */
export const ANTECEDENCIAS: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "Sem antecedência" },
  { valor: 30, rotulo: "30 minutos" },
  { valor: 60, rotulo: "1 hora" },
  { valor: 120, rotulo: "2 horas" },
  { valor: 180, rotulo: "3 horas" },
  { valor: 360, rotulo: "6 horas" },
  { valor: 720, rotulo: "12 horas" },
  { valor: 1440, rotulo: "1 dia" },
  { valor: 2880, rotulo: "2 dias" },
];

export const DIAS_A_FRENTE_MINIMO = 1;
export const DIAS_A_FRENTE_MAXIMO = 180;

/** Faixas por dia: mais que isso é engano de preenchimento. */
export const FAIXAS_POR_DIA = 6;

export const NOMES_DOS_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export type FaixaDaSemana = Faixa & { diaDaSemana: number };

/**
 * Lê as faixas que vieram do formulário, uma por campo, no formato
 * "dia|09:00|12:00". Recusa horário invertido e faixas que se cruzam no mesmo
 * dia, porque aí a página ofereceria o mesmo horário duas vezes.
 */
export function lerFaixas(valores: string[]): { faixas: FaixaDaSemana[] } | { erro: string } {
  const faixas: FaixaDaSemana[] = [];

  for (const valor of valores) {
    const partes = valor.split("|");
    if (partes.length !== 3) return { erro: "Não consegui entender um dos horários." };
    const diaDaSemana = Number(partes[0]);
    const inicioMin = horaParaMinutos(partes[1]);
    const lidoFim = horaParaMinutos(partes[2]);
    // O relógio do celular não escreve 24:00: "23:59" no fim quer dizer meia-noite.
    const fimMin = lidoFim === MINUTOS_NO_DIA - 1 ? MINUTOS_NO_DIA : lidoFim;
    if (!Number.isInteger(diaDaSemana) || diaDaSemana < 0 || diaDaSemana > 6) {
      return { erro: "Não consegui entender um dos dias." };
    }
    const nome = NOMES_DOS_DIAS[diaDaSemana];
    if (inicioMin === null || fimMin === null || inicioMin >= MINUTOS_NO_DIA) {
      return { erro: `${nome}: preencha a hora de começo e a de fim.` };
    }
    if (fimMin <= inicioMin) {
      return { erro: `${nome}: a hora de fim precisa ser depois da hora de começo.` };
    }
    faixas.push({ diaDaSemana, inicioMin, fimMin });
  }

  for (let dia = 0; dia < 7; dia++) {
    const doDia = faixas
      .filter((faixa) => faixa.diaDaSemana === dia)
      .sort((a, b) => a.inicioMin - b.inicioMin);
    if (doDia.length > FAIXAS_POR_DIA) {
      return { erro: `${NOMES_DOS_DIAS[dia]}: no máximo ${FAIXAS_POR_DIA} intervalos.` };
    }
    for (let i = 1; i < doDia.length; i++) {
      if (doDia[i].inicioMin < doDia[i - 1].fimMin) {
        return {
          erro: `${NOMES_DOS_DIAS[dia]}: os intervalos ${minutosParaHora(doDia[i - 1].inicioMin)}–${minutosParaHora(doDia[i - 1].fimMin)} e ${minutosParaHora(doDia[i].inicioMin)}–${minutosParaHora(doDia[i].fimMin)} se cruzam.`,
        };
      }
    }
  }

  return { faixas };
}

/** "09:00–12:00 e 13:00–18:00", para a tela. */
export function faixasPorExtenso(faixas: Faixa[]) {
  return faixas
    .map((faixa) => `${minutosParaHora(faixa.inicioMin)}–${minutosParaHora(faixa.fimMin)}`)
    .join(" e ");
}

/**
 * O WhatsApp de quem marca, só com os dígitos do número nacional (DDD e
 * número). Aceita com ou sem o 55 na frente; o resto volta null para a tela
 * pedir de novo. Pela mesma regra de lib/telefone.ts: decide pelo tamanho.
 */
export function telefoneNacional(texto: string): string | null {
  const digitos = apenasDigitos(texto);
  const nacional =
    digitos.length === 10 || digitos.length === 11
      ? digitos
      : (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")
        ? digitos.slice(2)
        : null;
  // DDD não começa com zero: "0xx" é prefixo de operadora digitado junto.
  if (!nacional || nacional.startsWith("0")) return null;
  return nacional;
}
