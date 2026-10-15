/**
 * Quem responde pelo Bossa: o nome, o documento e os contatos que aparecem nos
 * termos de uso, na política de privacidade, no rodapé do site e na tela de
 * senha esquecida.
 *
 * Os dados vêm das variáveis de ambiente, e não do código, porque mudam sem que
 * o programa mude: abrir um CNPJ, trocar o número do WhatsApp. Enquanto faltar
 * algum deles, as páginas mostram "a preencher" bem à vista no lugar, para
 * ninguém confundir um rascunho com o texto que vale.
 *
 * As páginas públicas são montadas na publicação do site, então mudar uma
 * dessas variáveis pede uma nova publicação para aparecer.
 */

import { apenasDigitos, documentoBonito, documentoValido, telefoneBonito } from "@/lib/formato";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";

export type Empresa = {
  /** Razão social ou nome de quem assina o serviço. */
  nome: string | null;
  /** CPF ou CNPJ já com pontuação, pronto para a tela. */
  documento: string | null;
  /** Qual dos dois o documento é, para a frase dizer "CNPJ" ou "CPF". */
  tipoDoDocumento: "CPF" | "CNPJ" | null;
  email: string | null;
  /** O WhatsApp como se lê: (66) 99251-3501. */
  whatsapp: string | null;
  /** O WhatsApp como o link do wa.me pede: só dígitos, com o 55 na frente. */
  whatsappComPais: string | null;
  /** Verdadeiro só quando os quatro dados existem e conferem. */
  dadosCompletos: boolean;
};

type Ambiente = Record<string, string | undefined>;

// Sem aspas nem sinais de tag: o e-mail vai parar dentro de um link mailto.
const EMAIL_VALIDO = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

function preenchido(valor: string | undefined, limite: number) {
  const limpo = valor?.trim();
  return limpo ? limpo.slice(0, limite) : null;
}

export function lerEmpresa(ambiente: Ambiente = process.env): Empresa {
  const nome = preenchido(ambiente.EMPRESA_NOME, 120);

  // Documento com dígito errado conta como faltando. Publicar um CPF ou CNPJ
  // errado nos termos é pior do que admitir que ele ainda não foi preenchido.
  const documentoBruto = preenchido(ambiente.EMPRESA_DOCUMENTO, 30);
  const digitos =
    documentoBruto && documentoValido(documentoBruto) ? apenasDigitos(documentoBruto) : null;
  const documento = digitos ? documentoBonito(digitos) : null;
  const tipoDoDocumento = digitos ? (digitos.length === 14 ? "CNPJ" : "CPF") : null;

  const emailBruto = preenchido(ambiente.CONTATO_EMAIL, 120)?.toLowerCase() ?? null;
  const email = emailBruto && EMAIL_VALIDO.test(emailBruto) ? emailBruto : null;

  const telefone = telefoneParaWhatsApp(preenchido(ambiente.CONTATO_WHATSAPP, 30));
  const whatsappComPais = telefone.certo ? telefone.paraWhatsApp : null;
  // O 55 do país sai só para mostrar; quem lê aqui é gente do Brasil.
  const whatsapp = whatsappComPais ? telefoneBonito(whatsappComPais.slice(2)) : null;

  return {
    nome,
    documento,
    tipoDoDocumento,
    email,
    whatsapp,
    whatsappComPais,
    dadosCompletos: Boolean(nome && documento && email && whatsapp),
  };
}

/** Os dados lidos uma vez, na montagem das páginas. */
export const EMPRESA = lerEmpresa();

/** Se falta algum dado da empresa. As páginas legais avisam quando falta. */
export const dadosCompletos = EMPRESA.dadosCompletos;

/** O que aparece no lugar de um dado que ainda não existe. */
export function aPreencher(oQue: string) {
  return `[${oQue} — a preencher]`;
}

/** O link que abre uma conversa com o Bossa no WhatsApp, com a primeira frase pronta. */
export function whatsappDoBossa(mensagem: string, empresa: Empresa = EMPRESA) {
  return empresa.whatsappComPais ? linkDoWhatsApp(empresa.whatsappComPais, mensagem) : null;
}
