/**
 * Recuperação de senha.
 *
 * O Bossa não tem envio de e-mail, então o caminho clássico (link no e-mail)
 * não existe. O caminho que funciona hoje é o que o estúdio já usa para tudo:
 * a pessoa pede pela tela de entrada, o pedido aparece na administração, e quem
 * cuida do Bossa gera um link e manda pelo WhatsApp dela.
 *
 * Quando houver envio de e-mail, a mesma tabela e as mesmas funções servem: só
 * muda quem entrega o link.
 *
 * Regras que valem aqui:
 * - o código nunca é guardado, só o resumo dele. Quem abrir o banco não
 *   consegue entrar na conta de ninguém;
 * - vale meia hora e uma vez só;
 * - usar um código derruba todos os outros daquela conta, e derruba também as
 *   sessões abertas: se alguém entrou com a senha antiga, sai.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Meia hora é tempo de mandar pelo WhatsApp e a pessoa abrir, e pouco mais. */
export const MINUTOS_DE_VALIDADE = 30;

/** 32 bytes de aleatório: não há como adivinhar nem tentar por força bruta. */
export function gerarCodigo() {
  return randomBytes(32).toString("base64url");
}

/**
 * O resumo guardado no banco.
 *
 * SHA-256 e não bcrypt de propósito: bcrypt existe para proteger senha humana,
 * que é curta e previsível. Aqui o segredo tem 256 bits de aleatório, então
 * não há o que adivinhar, e o resumo rápido permite procurar direto pelo índice
 * em vez de ler a tabela inteira comparando linha a linha.
 */
export function resumoDoCodigo(codigo: string) {
  return createHash("sha256").update(codigo).digest("hex");
}

/** Comparação em tempo constante, para não vazar o código pelo tempo de resposta. */
export function codigoConfere(codigo: string, resumoGuardado: string) {
  const calculado = Buffer.from(resumoDoCodigo(codigo), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(resumoGuardado, "hex");
  } catch {
    return false;
  }
  if (calculado.length !== guardado.length) return false;
  return timingSafeEqual(calculado, guardado);
}

export function validadeAPartirDe(agora = new Date()) {
  return new Date(agora.getTime() + MINUTOS_DE_VALIDADE * 60 * 1000);
}

export type Pedido = {
  expiraEm: Date;
  usadoEm: Date | null;
};

export function pedidoValido(pedido: Pedido | null | undefined, agora = new Date()) {
  if (!pedido) return false;
  if (pedido.usadoEm) return false;
  return pedido.expiraEm.getTime() > agora.getTime();
}

/** O endereço que a pessoa abre para escolher a senha nova. */
export function linkDaNovaSenha(enderecoDoSite: string, codigo: string) {
  return `${enderecoDoSite.replace(/\/+$/, "")}/nova-senha/${codigo}`;
}

/** A mensagem pronta para mandar pelo WhatsApp. */
export function mensagemDaNovaSenha({
  nome,
  link,
}: {
  nome: string;
  link: string;
}) {
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  return [
    `Oi, ${primeiro}! Aqui é do Bossa.`,
    "",
    "Este é o link para você escolher uma senha nova:",
    link,
    "",
    `Ele vale por ${MINUTOS_DE_VALIDADE} minutos e só funciona uma vez. Se não foi você quem pediu, pode ignorar.`,
  ].join("\n");
}

/** O mínimo de caracteres de uma senha. */
export const TAMANHO_MINIMO_DA_SENHA = 8;

/**
 * Palavras que, com números ou símbolos em volta, formam as senhas que alguém
 * tenta primeiro para invadir uma conta ("senha123", "Brasil@2026").
 */
const PALAVRAS_MAIS_USADAS = new Set([
  "senha", "minhasenha", "senhanova", "novasenha", "password", "passw", "pass",
  "qwerty", "asdf", "abc", "abcd", "admin", "administrador", "mudar", "trocar",
  "teste", "test", "bossa", "estudio", "salao", "beleza", "brasil", "amor",
  "deus", "jesus", "familia", "iloveyou", "teamo", "princesa", "flamengo",
  "corinthians", "palmeiras", "vasco", "gremio", "santos", "cruzeiro",
  "saopaulo", "botafogo", "fluminense", "internacional", "dragon", "monkey",
  "welcome", "login", "entrar", "acesso", "usuario", "user",
]);

/** Fileiras que se digitam sem pensar: alfabeto, números e teclado. */
const FILEIRAS = [
  "abcdefghijklmnopqrstuvwxyz",
  "01234567890",
  "qwertyuiop",
  "asdfghjklç",
  "zxcvbnm",
  "1qaz2wsx3edc4rfv",
];

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "abcd", "4321" e "qwer" são pedaços de uma fileira, para a frente ou para trás. */
function ehPedacoDeFileira(trecho: string) {
  if (!trecho) return false;
  const invertido = [...trecho].reverse().join("");
  return FILEIRAS.some((fileira) => fileira.includes(trecho) || fileira.includes(invertido));
}

/**
 * Diz o que há de errado com uma senha, ou `null` se ela serve.
 *
 * Não é um medidor de força: só recusa o que qualquer pessoa tentaria primeiro
 * para entrar numa conta alheia. Senha comprida e sem sentido passa, mesmo sem
 * símbolo nem letra maiúscula.
 */
export function problemaDaSenha(
  senha: string,
  dono: { email?: string | null; nome?: string | null } = {},
): string | null {
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
    return `Para ficar segura, a senha precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  }

  const limpa = semAcento(senha);
  const soLetrasENumeros = limpa.replace(/[^a-z0-9ç]/g, "");
  // Pedaços seguidos de letras ou de números: "abcd1234" vira ["abcd", "1234"].
  const pedacos = soLetrasENumeros.match(/[a-zç]+|[0-9]+/g) ?? [];

  const repeticao = /^(.{1,4})\1+$/.test(soLetrasENumeros);
  const sequencia = pedacos.length > 0 && pedacos.length <= 2 && pedacos.every(ehPedacoDeFileira);
  if (repeticao || sequencia) {
    return "Sequências e repetições, como 12345678, abcd1234 ou aaaaaaaa, são as primeiras que alguém tenta para invadir uma conta. Escolha outra.";
  }

  const letras = limpa.replace(/[^a-zç]/g, "");
  if (letras && PALAVRAS_MAIS_USADAS.has(letras)) {
    return "Essa senha está entre as mais usadas, e por isso é das primeiras que alguém tenta para invadir uma conta. Escolha outra.";
  }

  const pessoal = "A senha não pode ter o seu nome nem o seu e-mail. Escolha outra.";
  const antesDaArroba = semAcento(dono.email ?? "").split("@")[0] ?? "";
  if (antesDaArroba.length >= 4 && limpa.includes(antesDaArroba)) return pessoal;
  const partesDoNome = semAcento(dono.nome ?? "")
    .split(/[^a-zç]+/)
    .filter((parte) => parte.length >= 4);
  if (partesDoNome.some((parte) => limpa.includes(parte))) return pessoal;

  if (!letras && soLetrasENumeros.length < 12) {
    return "Senha só com números é fácil de adivinhar. Misture letras e números.";
  }

  return null;
}
