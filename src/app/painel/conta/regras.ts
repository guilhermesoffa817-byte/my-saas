/**
 * As regras da tela "Minha conta" que não dependem do banco nem da sessão.
 *
 * Ficam fora do arquivo de ações porque tudo o que um arquivo "use server"
 * exporta vira um endereço público. Aqui são funções puras, testadas sozinhas,
 * e leves o bastante para os formulários da tela importarem também.
 */

import { apenasDigitos, documentoValido } from "@/lib/formato";

export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** O que a pessoa digita para confirmar que quer mesmo apagar tudo. */
export const PALAVRA_DE_EXCLUSAO = "EXCLUIR";

export const TAMANHO_MINIMO_DA_SENHA = 8;

/**
 * Tetos de tamanho. Não é implicância: o nome do estúdio vai em toda mensagem
 * de cobrança, e um texto de mil letras quebraria a mensagem e a tela.
 */
const TETO = { nome: 80, nomeNegocio: 80, email: 120, endereco: 200 } as const;

export type DadosDaConta = {
  nome: string;
  nomeNegocio: string;
  email: string;
  telefone: string;
  documento: string;
  cep: string | null;
  endereco: string | null;
};

type Conferido<T> = { certo: true; valores: T } | { certo: false; erro: string };

/**
 * Confere os dados do cadastro com as mesmas regras de quem cria a conta.
 * Devolve os valores já limpos, do jeito que vão para o banco.
 */
export function conferirDadosDaConta(entrada: {
  nome: string;
  nomeNegocio: string;
  email: string;
  telefone: string;
  documento: string;
  cep: string;
  endereco: string;
}): Conferido<DadosDaConta> {
  const nome = entrada.nome.trim();
  const nomeNegocio = entrada.nomeNegocio.trim();
  // O e-mail é o login, e a entrada procura sempre em minúsculas.
  const email = entrada.email.trim().toLowerCase();
  const telefone = entrada.telefone.trim();
  const documento = apenasDigitos(entrada.documento);
  const cep = apenasDigitos(entrada.cep);
  const endereco = entrada.endereco.trim();

  if (!nome || !nomeNegocio || !email || !telefone || !documento) {
    return {
      certo: false,
      erro: "Ainda falta preencher algum campo. Pode conferir, por favor?",
    };
  }
  if (nome.length > TETO.nome) {
    return { certo: false, erro: `Seu nome pode ter até ${TETO.nome} letras.` };
  }
  if (nomeNegocio.length > TETO.nomeNegocio) {
    return {
      certo: false,
      erro: `O nome do estúdio pode ter até ${TETO.nomeNegocio} letras. Ele vai em toda cobrança, então curto fica melhor.`,
    };
  }
  if (email.length > TETO.email || !EMAIL_VALIDO.test(email)) {
    return {
      certo: false,
      erro: "Esse e-mail parece incompleto. Pode escrevê-lo novamente?",
    };
  }
  const digitosDoTelefone = apenasDigitos(telefone).length;
  if (digitosDoTelefone < 10 || digitosDoTelefone > 13) {
    return {
      certo: false,
      erro: "O WhatsApp precisa ter DDD e número, como (66) 99251-3501.",
    };
  }
  if (!documentoValido(documento)) {
    return {
      certo: false,
      erro: "Esse CPF ou CNPJ não confere. Pode checar os números?",
    };
  }
  if (cep && cep.length !== 8) {
    return { certo: false, erro: "O CEP tem 8 números, como 78000-000. Pode conferir?" };
  }
  if (endereco.length > TETO.endereco) {
    return { certo: false, erro: `O endereço pode ter até ${TETO.endereco} letras.` };
  }

  return {
    certo: true,
    valores: {
      nome,
      nomeNegocio,
      email,
      telefone,
      documento,
      cep: cep || null,
      endereco: endereco || null,
    },
  };
}

/**
 * O e-mail é por onde se entra e o WhatsApp é por onde chega o link de senha
 * nova. Quem muda um dos dois muda a porta da conta, e por isso a senha atual
 * é pedida. Sem isso, um celular esquecido aberto no painel bastaria para
 * alguém trocar o WhatsApp, pedir uma senha nova e ficar com a conta.
 */
export function mudaAPortaDeEntrada(
  atual: { email: string; telefone: string | null },
  novo: { email: string; telefone: string },
) {
  return (
    atual.email.trim().toLowerCase() !== novo.email.trim().toLowerCase() ||
    apenasDigitos(atual.telefone ?? "") !== apenasDigitos(novo.telefone)
  );
}

/** Confere a senha nova. Devolve o erro, ou null quando está tudo certo. */
export function erroDaSenhaNova(entrada: {
  atual: string;
  nova: string;
  repetida: string;
}) {
  if (!entrada.atual) return "Digite a sua senha atual para continuar.";
  if (entrada.nova.length < TAMANHO_MINIMO_DA_SENHA) {
    return `Para ficar seguro, a senha nova precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  }
  if (entrada.nova !== entrada.repetida) {
    return "As duas senhas novas não são iguais. Pode conferir?";
  }
  if (entrada.nova === entrada.atual) {
    return "A senha nova precisa ser diferente da atual.";
  }
  return null;
}

/**
 * A palavra de confirmação. Aceita minúsculas e espaços nas pontas, porque o
 * teclado do celular costuma pôr a primeira letra maiúscula e um espaço no fim
 * sozinho. O que importa é a pessoa ter parado para escrever.
 */
export function exclusaoConfirmada(digitado: string) {
  return digitado.trim().toUpperCase() === PALAVRA_DE_EXCLUSAO;
}
