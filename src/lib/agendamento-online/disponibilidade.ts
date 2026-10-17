/**
 * Horário livre para o agendamento online: só conta, sem banco.
 *
 * Tudo aqui é função pura, para que a página pública e a confirmação usem a
 * MESMA regra, e para que o teste confira essa regra sem montar banco. Quem
 * chama traz os atendimentos já marcados e as ausências; aqui só se decide que
 * horários sobram.
 *
 * Dia é sempre "AAAA-MM-DD" no calendário do estúdio (São Paulo), e minuto é
 * contado a partir da meia-noite desse dia. O instante de verdade sai de
 * `deHorarioLocal`, a mesma conversão do resto do Bossa: o horário das 9h é 9h
 * em São Paulo, esteja o servidor onde estiver.
 */
import { deDataPura, deHorarioLocal, hojeNoEstudio, paraDataPura, somarDiasPuros } from "@/lib/formato";

/** De quanto em quanto tempo a página oferece horário. */
export const PASSO_MIN = 30;

export const MINUTOS_NO_DIA = 24 * 60;

/** Um intervalo de atendimento num dia: das 9h (540) às 12h (720). */
export type Faixa = { inicioMin: number; fimMin: number };

/** Um pedaço de tempo que já tem dono: um atendimento marcado. */
export type Ocupado = { inicio: Date; fim: Date };

/** 0 = domingo ... 6 = sábado, do dia de calendário (não do instante). */
export function diaDaSemanaDoDia(dia: string) {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}

function doisDigitos(n: number) {
  return String(n).padStart(2, "0");
}

/** "09:30" a partir de 570. 1440 vira "24:00", o fim do dia. */
export function minutosParaHora(minutos: number) {
  return `${doisDigitos(Math.floor(minutos / 60))}:${doisDigitos(minutos % 60)}`;
}

/** 570 a partir de "09:30". Aceita "24:00" como fim do dia; o resto, null. */
export function horaParaMinutos(texto: string): number | null {
  const encontrado = /^(\d{2}):(\d{2})$/.exec(texto.trim());
  if (!encontrado) return null;
  const horas = Number(encontrado[1]);
  const minutos = Number(encontrado[2]);
  if (minutos > 59) return null;
  if (horas === 24 && minutos === 0) return MINUTOS_NO_DIA;
  if (horas > 23) return null;
  return horas * 60 + minutos;
}

/**
 * O instante que corresponde a `minutos` depois da meia-noite do dia, em São
 * Paulo. 1440 (ou mais) passa para o dia seguinte: quem fecha "à meia-noite"
 * fecha às 00:00 do outro dia, e não às 00:00 do mesmo dia.
 */
export function instanteNoDia(dia: string, minutos: number) {
  const diasAMais = Math.floor(minutos / MINUTOS_NO_DIA);
  const resto = minutos - diasAMais * MINUTOS_NO_DIA;
  const data = diasAMais === 0 ? dia : paraDataPura(somarDiasPuros(deDataPura(dia)!, diasAMais));
  return deHorarioLocal(`${data}T${minutosParaHora(resto)}`)!;
}

function seChocam(a: Ocupado, b: Ocupado) {
  return a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();
}

/**
 * Os horários de início livres de UMA agenda num dia.
 *
 * Um horário vale quando: cabe inteiro dentro de uma faixa (o serviço termina
 * até o fim dela), começa depois de agora mais a antecedência mínima e não
 * esbarra em nenhum atendimento já marcado. Os horários andam de 30 em 30
 * minutos a partir do começo de cada faixa.
 */
export function horariosLivres(params: {
  dia: string;
  faixas: Faixa[];
  ocupados: Ocupado[];
  duracaoMin: number;
  agora: Date;
  antecedenciaMin: number;
  passoMin?: number;
}): Date[] {
  const passo = params.passoMin ?? PASSO_MIN;
  const duracao = Math.max(1, Math.round(params.duracaoMin));
  const limite = params.agora.getTime() + Math.max(0, params.antecedenciaMin) * 60_000;
  const encontrados = new Map<number, Date>();

  for (const faixa of params.faixas) {
    for (let minuto = faixa.inicioMin; minuto + duracao <= faixa.fimMin; minuto += passo) {
      const inicio = instanteNoDia(params.dia, minuto);
      if (inicio.getTime() < limite) continue;
      const candidato = { inicio, fim: new Date(inicio.getTime() + duracao * 60_000) };
      if (params.ocupados.some((ocupado) => seChocam(candidato, ocupado))) continue;
      encontrados.set(inicio.getTime(), inicio);
    }
  }

  return [...encontrados.values()].sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Uma agenda que atende: a própria dona (id null) ou alguém da equipe.
 * `fora` diz se a pessoa não trabalha nesse dia (ausência, ainda não entrou,
 * já saiu); nesse caso ela não oferece horário nenhum.
 */
export type Agenda = {
  id: string | null;
  ocupados: Ocupado[];
  fora: (dia: string) => boolean;
};

export type HorarioDaEquipe = { inicio: Date; livres: (string | null)[] };

/**
 * Os horários livres de várias agendas juntas. Cada horário traz quem está
 * livre nele, na ordem em que as agendas vieram, para a confirmação escolher.
 */
export function horariosLivresDasAgendas(params: {
  dia: string;
  faixas: Faixa[];
  agendas: Agenda[];
  duracaoMin: number;
  agora: Date;
  antecedenciaMin: number;
  passoMin?: number;
}): HorarioDaEquipe[] {
  const porInstante = new Map<number, HorarioDaEquipe>();

  for (const agenda of params.agendas) {
    if (agenda.fora(params.dia)) continue;
    const livres = horariosLivres({
      dia: params.dia,
      faixas: params.faixas,
      ocupados: agenda.ocupados,
      duracaoMin: params.duracaoMin,
      agora: params.agora,
      antecedenciaMin: params.antecedenciaMin,
      passoMin: params.passoMin,
    });
    for (const inicio of livres) {
      const atual = porInstante.get(inicio.getTime()) ?? { inicio, livres: [] };
      atual.livres.push(agenda.id);
      porInstante.set(inicio.getTime(), atual);
    }
  }

  return [...porInstante.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/**
 * Os dias que a página oferece: de hoje, no calendário do estúdio, até
 * `diasAFrente` dias depois. Às 23h de São Paulo ainda é hoje, mesmo que em
 * UTC já seja amanhã.
 */
export function diasDaJanela(agora: Date, diasAFrente: number): string[] {
  const hoje = hojeNoEstudio(agora);
  const dias: string[] = [];
  for (let n = 0; n <= Math.max(0, diasAFrente); n++) {
    dias.push(paraDataPura(somarDiasPuros(hoje, n)));
  }
  return dias;
}

/** As faixas de um dia da semana, em ordem. */
export function faixasDoDia(
  faixas: (Faixa & { diaDaSemana: number })[],
  dia: string,
): Faixa[] {
  const semana = diaDaSemanaDoDia(dia);
  return faixas
    .filter((faixa) => faixa.diaDaSemana === semana)
    .map(({ inicioMin, fimMin }) => ({ inicioMin, fimMin }))
    .sort((a, b) => a.inicioMin - b.inicioMin);
}

/**
 * Quem fica com o horário. Pedido de alguém específico só vale se essa pessoa
 * estiver livre; "qualquer" fica com a primeira livre. `undefined` quer dizer
 * que ninguém pode: o horário foi ocupado no meio do caminho.
 */
export function escolherQuemAtende(
  livres: (string | null)[],
  pedido: { qualquer: true } | { id: string | null },
): string | null | undefined {
  if ("qualquer" in pedido) return livres.length > 0 ? livres[0] : undefined;
  return livres.includes(pedido.id) ? pedido.id : undefined;
}
