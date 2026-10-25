/**
 * O código Pix "copia e cola" (BR Code estático, padrão do Banco Central).
 *
 * É um texto de campos encadeados, cada um no formato id + tamanho em dois
 * dígitos + conteúdo. O banco de quem paga lê isso; um caractere errado e o
 * aplicativo diz só "código inválido", sem dizer onde. Por isso tudo aqui é
 * conservador: sem acento, dentro do limite de cada campo, valor com ponto e
 * duas casas, e o CRC16 no fim conferindo o resto.
 *
 * Estava dentro de lib/assinatura.ts, servindo só à mensalidade do Bossa. Saiu
 * para cá porque agora cada estúdio também cobra os clientes dele por Pix.
 */

import { apenasDigitos, cnpjValido, cpfBonito, cpfValido, documentoBonito } from "@/lib/formato";

export type TipoDeChave = "telefone" | "cpf" | "cnpj" | "email" | "aleatoria";

export const TIPOS_DE_CHAVE: TipoDeChave[] = ["telefone", "cpf", "cnpj", "email", "aleatoria"];

export const ROTULO_DO_TIPO_DE_CHAVE: Record<TipoDeChave, string> = {
  telefone: "Celular",
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

export function ehTipoDeChave(valor: unknown): valor is TipoDeChave {
  return typeof valor === "string" && (TIPOS_DE_CHAVE as string[]).includes(valor);
}

export type LeituraDaChave =
  | { certo: true; chave: string; tipo: TipoDeChave }
  | { certo: false; motivo: "vazia" | "ambigua" | "invalida"; mensagem: string };

/** Os DDDs que existem no Brasil (Anatel). Um celular com DDD fora daqui não é celular. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** CPF escrito com a pontuação dele: 529.982.247-25 (os pontos podem faltar, o hífen não). */
const CPF_ESCRITO = /^\d{3}\.?\d{3}\.?\d{3}-\d{2}$/;
/** CNPJ escrito com a pontuação dele: 11.222.333/0001-81. */
const CNPJ_ESCRITO = /^\d{2}\.?\d{3}\.?\d{3}\/\d{4}-\d{2}$/;
/**
 * Telefone escrito como telefone: DDD separado do número, (66) 99251-3501,
 * 66 99251-3501 ou +55 66 99251-3501. Onze números grudados não entram aqui.
 */
const TELEFONE_ESCRITO = /^(?:\+?55[\s.-]*)?(?:\(\d{2}\)\s*|\d{2}[\s.-]+)\d{4,5}[\s.-]?\d{4}$/;

const CHAVE_ALEATORIA = /^[0-9a-f]{32}$/;

/**
 * O número nacional (DDD + número) de um telefone, se ele tiver cara de
 * telefone brasileiro: DDD que existe e, com onze números, o 9 do celular
 * logo depois do DDD. A decisão do país é pelo tamanho, nunca pelo começo:
 * 55 também é o DDD da serra gaúcha (ver lib/telefone.ts).
 */
function nacionalDoTelefone(digitos: string, temMais: boolean): string | null {
  let nacional = digitos;
  if (digitos.length === 12 || digitos.length === 13) {
    if (!digitos.startsWith("55")) return null;
    nacional = digitos.slice(2);
  } else if (temMais) {
    // Com o sinal de mais, o país precisa estar ali: só existe chave Pix de telefone do Brasil.
    return null;
  }
  if (nacional.length !== 10 && nacional.length !== 11) return null;
  if (!DDDS.has(Number(nacional.slice(0, 2)))) return null;
  if (nacional.length === 11 && nacional[2] !== "9") return null;
  return nacional;
}

const MENSAGEM = {
  ambigua:
    "Esse número pode ser um CPF ou um celular. Escolha o tipo da chave para o Pix não ir para outra pessoa.",
  invalida:
    "Não reconheci essa chave Pix. Use o celular com DDD, o CPF, o CNPJ, o e-mail ou a chave aleatória, exatamente como no seu banco.",
  cpf: "Esse CPF não confere. Confira os números, exatamente como no seu banco.",
  cnpj: "Esse CNPJ não confere. Confira os números, exatamente como no seu banco.",
  telefone: "Esse celular não confere. Use o DDD e o número, como (66) 99251-3501.",
  email: "Esse e-mail não parece certo. Confira, exatamente como no seu banco.",
  aleatoria:
    "A chave aleatória tem 32 letras e números, como 123e4567-e89b-12d3-a456-426614174000. Copie do seu banco.",
} as const;

function invalida(mensagem: string): LeituraDaChave {
  return { certo: false, motivo: "invalida", mensagem };
}

function lerComTipo(limpa: string, tipo: TipoDeChave): LeituraDaChave {
  const digitos = apenasDigitos(limpa);
  switch (tipo) {
    case "email": {
      const email = limpa.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 77) return invalida(MENSAGEM.email);
      return { certo: true, chave: email, tipo };
    }
    case "aleatoria": {
      const hexa = limpa.toLowerCase().replace(/-/g, "");
      if (!CHAVE_ALEATORIA.test(hexa)) return invalida(MENSAGEM.aleatoria);
      // O formato do Banco Central é o do UUID: 8-4-4-4-12, em minúsculas, com os hífens.
      const chave = `${hexa.slice(0, 8)}-${hexa.slice(8, 12)}-${hexa.slice(12, 16)}-${hexa.slice(16, 20)}-${hexa.slice(20)}`;
      return { certo: true, chave, tipo };
    }
    case "cpf":
      if (/[^\d\s.-]/.test(limpa) || !cpfValido(digitos)) return invalida(MENSAGEM.cpf);
      return { certo: true, chave: digitos, tipo };
    case "cnpj":
      if (/[^\d\s./-]/.test(limpa) || !cnpjValido(digitos)) return invalida(MENSAGEM.cnpj);
      return { certo: true, chave: digitos, tipo };
    case "telefone": {
      if (/[^\d\s()+.-]/.test(limpa)) return invalida(MENSAGEM.telefone);
      const nacional = nacionalDoTelefone(digitos, limpa.startsWith("+"));
      if (!nacional) return invalida(MENSAGEM.telefone);
      return { certo: true, chave: `+55${nacional}`, tipo };
    }
  }
}

/**
 * Lê a chave Pix e devolve no formato que o BR Code espera: telefone com +55,
 * CPF e CNPJ só com os dígitos, e-mail em minúsculas e chave aleatória com os
 * hífens do UUID.
 *
 * Com o `tipo` informado (a pessoa escolheu na tela), só confere a chave
 * contra ele. Sem o tipo, decide pela forma, e nunca no chute: o CPF já foi
 * lido como celular aqui, e o Pix ia para o telefone +55 de um desconhecido.
 *
 *  - CPF com pontuação (529.982.247-25) é CPF; telefone com DDD separado,
 *    parênteses ou +55 é telefone.
 *  - Onze números grudados: é CPF se os dígitos verificadores conferem e não
 *    é celular (DDD que existe e 9 depois dele); é celular no caso contrário.
 *    Quando servem para os dois, a chave é ambígua e a tela pergunta o tipo.
 */
export function lerChavePix(chave: string, tipo?: TipoDeChave | null): LeituraDaChave {
  const limpa = chave.trim();
  if (!limpa) return { certo: false, motivo: "vazia", mensagem: MENSAGEM.invalida };
  if (tipo) return lerComTipo(limpa, tipo);

  if (limpa.includes("@")) return lerComTipo(limpa, "email");
  if (CHAVE_ALEATORIA.test(limpa.toLowerCase().replace(/-/g, ""))) return lerComTipo(limpa, "aleatoria");
  if (limpa.startsWith("+") || /[()]/.test(limpa) || TELEFONE_ESCRITO.test(limpa)) {
    return lerComTipo(limpa, "telefone");
  }
  if (CPF_ESCRITO.test(limpa)) return lerComTipo(limpa, "cpf");
  if (CNPJ_ESCRITO.test(limpa)) return lerComTipo(limpa, "cnpj");

  // Daqui para baixo, só números (com espaço, ponto ou hífen soltos no meio).
  if (/[^\d\s.-]/.test(limpa)) return invalida(MENSAGEM.invalida);
  const digitos = apenasDigitos(limpa);

  if (digitos.length === 14) return lerComTipo(digitos, "cnpj");
  if (digitos.length === 11) {
    const ehCpf = cpfValido(digitos);
    const ehCelular = nacionalDoTelefone(digitos, false) !== null;
    if (ehCpf && ehCelular) return { certo: false, motivo: "ambigua", mensagem: MENSAGEM.ambigua };
    if (ehCpf) return { certo: true, chave: digitos, tipo: "cpf" };
    if (ehCelular) return { certo: true, chave: `+55${digitos}`, tipo: "telefone" };
    return invalida(MENSAGEM.invalida);
  }
  if (digitos.length === 10 || digitos.length === 12 || digitos.length === 13) {
    return lerComTipo(digitos, "telefone");
  }
  return invalida(MENSAGEM.invalida);
}

/** A chave no formato do BR Code, ou null quando não dá para ter certeza do que ela é. */
export function normalizarChavePix(
  chave: string,
  tipo?: TipoDeChave | null,
): { chave: string; tipo: TipoDeChave } | null {
  const lida = lerChavePix(chave, tipo);
  return lida.certo ? { chave: lida.chave, tipo: lida.tipo } : null;
}

/**
 * Como a chave fica guardada no cadastro e aparece na tela: num formato que,
 * lido de novo sem o tipo, dá sempre o mesmo tipo. CPF com pontos e hífen,
 * CNPJ com a pontuação, telefone com +55, e-mail e chave aleatória como o
 * BR Code espera.
 */
export function chaveParaGuardar(lida: { chave: string; tipo: TipoDeChave }) {
  if (lida.tipo === "cpf") return cpfBonito(lida.chave);
  if (lida.tipo === "cnpj") return documentoBonito(lida.chave);
  return lida.chave;
}

/** "CPF 529.982.247-25", "Celular +55 66 99251-3501": para confirmar o que foi entendido. */
export function chavePorExtenso(lida: { chave: string; tipo: TipoDeChave }) {
  if (lida.tipo === "telefone") {
    const nacional = lida.chave.slice(3);
    const numero =
      nacional.length === 11
        ? `${nacional.slice(2, 7)}-${nacional.slice(7)}`
        : `${nacional.slice(2, 6)}-${nacional.slice(6)}`;
    return `Celular +55 ${nacional.slice(0, 2)} ${numero}`;
  }
  return `${ROTULO_DO_TIPO_DE_CHAVE[lida.tipo]} ${chaveParaGuardar(lida)}`;
}

/** Tira acento e tudo o que o BR Code não aceita, e deixa em maiúsculas. */
export function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function campo(id: string, valor: string) {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

export function crc16(texto: string) {
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

export type PedidoDePix = {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos: number;
  /** Aparece no extrato de quem paga. Só letras e números, até 25 caracteres. */
  identificador?: string;
};

export type ResultadoDoPix =
  | { certo: true; codigo: string }
  | { certo: false; motivo: string };

export function montarPix({
  chave,
  nome,
  cidade,
  valorCentavos,
  identificador = "***",
}: PedidoDePix): ResultadoDoPix {
  const normalizada = lerChavePix(chave);
  if (!normalizada.certo) {
    return {
      certo: false,
      motivo:
        normalizada.motivo === "ambigua"
          ? "A chave Pix cadastrada pode ser um CPF ou um celular. Abra os ajustes das cobranças e escolha o tipo dela."
          : normalizada.mensagem,
    };
  }

  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    return { certo: false, motivo: "O valor da cobrança precisa ser maior que zero." };
  }
  // O campo do valor tem treze caracteres; acima disso o código sai quebrado.
  if (valorCentavos > 99_999_999_999) {
    return { certo: false, motivo: "Esse valor é alto demais para um código Pix." };
  }

  const nomeLimpo = semAcento(nome).slice(0, 25) || "ESTUDIO";
  const cidadeLimpa = semAcento(cidade).slice(0, 15) || "SAO PAULO";
  const idLimpo = semAcento(identificador).replace(/\s/g, "").slice(0, 25) || "***";

  const conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizada.chave);

  const semCrc =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", nomeLimpo) +
    campo("60", cidadeLimpa) +
    campo("62", campo("05", idLimpo)) +
    "6304";

  return { certo: true, codigo: semCrc + crc16(semCrc) };
}

/** Lê um código montado e devolve os campos, para os testes conferirem. */
export function lerCamposDoPix(codigo: string) {
  const campos: Record<string, string> = {};
  let posicao = 0;
  while (posicao + 4 <= codigo.length) {
    const id = codigo.slice(posicao, posicao + 2);
    const tamanho = Number(codigo.slice(posicao + 2, posicao + 4));
    if (!Number.isFinite(tamanho)) break;
    campos[id] = codigo.slice(posicao + 4, posicao + 4 + tamanho);
    posicao += 4 + tamanho;
  }
  return campos;
}
