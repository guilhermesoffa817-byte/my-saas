export const FUSO = "America/Sao_Paulo";

export function emReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Converte "1.234,56" ou "1234.56" ou "1234" em centavos. */
export function paraCentavos(valor: string): number | null {
  const limpo = valor.trim().replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero * 100);
}

export function dataCurta(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function dataPorExtenso(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function hora(data: Date) {
  return data.toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataEHora(data: Date) {
  return `${dataCurta(data)} às ${hora(data)}`;
}

export function diaDaSemana(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long" });
}

/** "seg", "ter"... sem o ponto que o navegador às vezes acrescenta. */
export function diaDaSemanaCurto(data: Date) {
  return data
    .toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "short" })
    .replace(".", "")
    .slice(0, 3);
}

/** O número do dia no mês, respeitando o fuso do estúdio. */
export function diaDoMes(data: Date) {
  return Number(paraDataLocal(data).slice(8, 10));
}

/** Segunda-feira da semana em que a data cai. */
export function inicioDaSemana(data: Date) {
  const local = deDataLocal(paraDataLocal(data)) ?? data;
  const sigla = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    weekday: "short",
  }).format(local);
  const ordem = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(sigla);
  return somarDias(local, ordem > 0 ? -ordem : 0);
}


function partesNoFuso(data: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(data);

  const mapa: Record<string, number> = {};
  for (const parte of partes) {
    if (parte.type !== "literal") mapa[parte.type] = Number(parte.value);
  }
  // Intl usa "24" para meia-noite em alguns ambientes.
  if (mapa.hour === 24) mapa.hour = 0;
  return mapa;
}

function deslocamentoMs(data: Date) {
  const p = partesNoFuso(data);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - data.getTime();
}

/** Recebe o valor de um <input type="datetime-local"> e devolve a data real. */
export function deHorarioLocal(valor: string): Date | null {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor.trim());
  if (!encontrado) return null;
  const [, ano, mes, dia, h, min] = encontrado.map(Number);
  const palpite = new Date(Date.UTC(ano, mes - 1, dia, h, min));
  const data = new Date(palpite.getTime() - deslocamentoMs(palpite));
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Recebe o valor de um <input type="date"> e devolve a data real (meia-noite local). */
export function deDataLocal(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return null;
  return deHorarioLocal(`${valor.trim()}T00:00`);
}

/** Formata uma data para preencher um <input type="datetime-local">. */
export function paraHorarioLocal(data: Date) {
  const p = partesNoFuso(data);
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${doisDigitos(p.month)}-${doisDigitos(p.day)}T${doisDigitos(p.hour)}:${doisDigitos(p.minute)}`;
}

/** Formata uma data para preencher um <input type="date">. */
export function paraDataLocal(data: Date) {
  return paraHorarioLocal(data).slice(0, 10);
}

/** Início do dia (00:00 no fuso de São Paulo) da data informada. */
export function inicioDoDia(data: Date) {
  return deHorarioLocal(`${paraDataLocal(data)}T00:00`)!;
}

/** Primeiro instante do mês (no fuso de São Paulo) da data informada. */
export function inicioDoMes(data: Date) {
  const p = partesNoFuso(data);
  return deHorarioLocal(`${p.year}-${String(p.month).padStart(2, "0")}-01T00:00`)!;
}

/** Primeiro instante do mês seguinte (no fuso de São Paulo). */
export function inicioDoProximoMes(data: Date) {
  const p = partesNoFuso(data);
  const ano = p.month === 12 ? p.year + 1 : p.year;
  const mes = p.month === 12 ? 1 : p.month + 1;
  return deHorarioLocal(`${ano}-${String(mes).padStart(2, "0")}-01T00:00`)!;
}

export function somarDias(data: Date, dias: number) {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000);
}

export function telefoneBonito(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return telefone;
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function competenciaAtual(data = new Date()) {
  const p = partesNoFuso(data);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function competenciaPorExtenso(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return competencia;
  const nome = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Guarda só os 11 dígitos; a máscara é coisa de tela. */
export function apenasDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/** Confere os dois dígitos verificadores do CPF. */
export function cpfValido(cpf: string) {
  const numeros = apenasDigitos(cpf);
  if (numeros.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numeros)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(numeros[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(numeros[9]) && digito(10) === Number(numeros[10]);
}

export function cpfBonito(cpf: string | null) {
  const numeros = cpf ? apenasDigitos(cpf) : "";
  if (numeros.length !== 11) return cpf ?? "";
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
}
