/**
 * O freio da senha.
 *
 * Sem ele, qualquer um podia ficar chutando senhas na tela de entrada sem
 * parar. Depois de algumas tentativas erradas no mesmo e-mail, a conferência
 * espera alguns minutos antes de aceitar a próxima, e nesse meio-tempo nem a
 * senha certa passa: quem estava chutando não fica sabendo que acertou.
 *
 * O freio vale para qualquer e-mail digitado, exista a conta ou não. Se valesse
 * só para os e-mails cadastrados, bastaria errar algumas vezes para descobrir
 * quem tem conta aqui.
 *
 * Dentro do painel, ao trocar a senha ou excluir a conta, vale o mesmo freio,
 * com uma contagem própria para cada conta.
 *
 * O banco guarda só um resumo e a hora, nunca o e-mail em texto nem a senha
 * digitada.
 *
 * As funções que tocam o banco recebem o cliente do Prisma por parâmetro: a
 * ação usa o do site e os testes usam o do banco de teste, sem precisar de
 * cookie nem de requisição.
 */

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/generated/prisma";

/** Quantas senhas erradas cabem na janela antes de a entrada esperar. */
export const TENTATIVAS_ANTES_DE_ESPERAR = 8;

/** O tamanho da janela, que é também quanto tempo a pessoa espera, no máximo. */
export const MINUTOS_DE_ESPERA = 15;

/** Depois de um dia, uma tentativa errada já não serve para nada e pode sair. */
export const HORAS_DE_GUARDA = 24;

export const RECADO_DE_ESPERA = `Foram muitas tentativas seguidas com esse e-mail. Por segurança, espere uns ${MINUTOS_DE_ESPERA} minutos e tente de novo, ou toque em "Esqueci minha senha" para pedir uma nova.`;

export const RECADO_DE_SENHA_ERRADA =
  "E-mail ou senha não batem. Tenta de novo com calma?";

/**
 * O freio vale também para a senha pedida dentro do painel, ao trocar a senha
 * ou excluir a conta. Ali a pessoa já entrou, então o recado não manda para o
 * "Esqueci minha senha".
 */
export const RECADO_DE_ESPERA_NO_PAINEL = `Foram muitas tentativas com a senha errada. Por segurança, espere uns ${MINUTOS_DE_ESPERA} minutos e tente de novo.`;

// Usado só para gastar o mesmo tempo quando o e-mail não existe.
const HASH_FALSO = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * O resumo do e-mail que identifica as tentativas.
 *
 * Em minúsculas e sem espaços nas pontas, porque é assim que a entrada procura
 * a conta: "Ana@x.com" e "ana@x.com " são a mesma porta e contam juntos.
 */
export function chaveDoEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * A chave da senha pedida dentro do painel, ao trocar a senha ou excluir a
 * conta. É separada da chave da entrada de propósito: quem estiver chutando
 * senha na tela de entrada não pode impedir a dona, que já entrou, de trocar a
 * senha justamente nessa hora. E quem chuta aqui dentro tem o próprio freio.
 */
export function chaveDoPainel(usuarioId: string) {
  return createHash("sha256").update(`painel:${usuarioId}`).digest("hex");
}

/** A partir de quando as tentativas erradas ainda contam. */
export function inicioDaJanela(agora = new Date()) {
  return new Date(agora.getTime() - MINUTOS_DE_ESPERA * 60 * 1000);
}

/** Antes disto, as tentativas podem ser apagadas. */
export function fimDaGuarda(agora = new Date()) {
  return new Date(agora.getTime() - HORAS_DE_GUARDA * 60 * 60 * 1000);
}

export function precisaEsperar(errosNaJanela: number) {
  return errosNaJanela >= TENTATIVAS_ANTES_DE_ESPERAR;
}

/** O que o freio precisa do banco. O cliente do site e o dos testes servem. */
export type BancoDoFreio = Pick<PrismaClient, "tentativaDeEntrada">;

export type Conferencia = "confere" | "errada" | "espere";

/**
 * Confere uma senha passando pelo freio. A chave vem pronta: a da entrada,
 * pelo e-mail, ou a do painel, pela conta.
 *
 * A contagem vem antes da conferência: na hora de esperar, a senha nem é
 * olhada. A tentativa barrada não conta como erro novo; se contasse, quem
 * insistisse durante a espera nunca mais sairia dela.
 */
export async function conferirComFreio(
  db: BancoDoFreio,
  chave: string,
  conferir: () => Promise<boolean>,
  agora = new Date(),
): Promise<Conferencia> {
  const erros = await db.tentativaDeEntrada.count({
    where: { chave, criadoEm: { gte: inicioDaJanela(agora) } },
  });
  if (precisaEsperar(erros)) return "espere";

  if (await conferir()) {
    // Acertou: a contagem dessa chave recomeça do zero.
    await db.tentativaDeEntrada.deleteMany({ where: { chave } });
    return "confere";
  }

  await db.tentativaDeEntrada.create({ data: { chave, criadoEm: agora } });

  // Faxina de passagem, sem tarefa agendada: o que tem mais de um dia sai.
  // Só acontece quando alguém erra, então não pesa na entrada de quem acerta.
  await db.tentativaDeEntrada.deleteMany({
    where: { criadoEm: { lt: fimDaGuarda(agora) } },
  });

  return "errada";
}

export type BancoDaEntrada = Pick<PrismaClient, "tentativaDeEntrada" | "usuario">;

export type ResultadoDaEntrada =
  | { certo: true; usuario: { id: string; sessaoVersao: number } }
  | { certo: false; erro: string };

/**
 * A conferência inteira da tela de entrada: freio, conta e senha.
 *
 * Fica aqui, e não na ação, para que o teste rode exatamente o mesmo caminho
 * que a pessoa percorre ao tocar em "Entrar". A ação só cria a sessão depois.
 */
export async function conferirEntrada(
  db: BancoDaEntrada,
  email: string,
  senha: string,
  agora = new Date(),
): Promise<ResultadoDaEntrada> {
  const emailLimpo = email.trim().toLowerCase();
  const achado: { usuario?: { id: string; sessaoVersao: number } } = {};

  const resultado = await conferirComFreio(
    db,
    chaveDoEmail(emailLimpo),
    async () => {
      const conta = await db.usuario.findUnique({
        where: { email: emailLimpo },
        select: { id: true, senhaHash: true, sessaoVersao: true },
      });
      // Sem conta, compara com um resumo qualquer só para levar o mesmo tempo:
      // a demora da resposta não pode contar se o e-mail existe.
      const confere = await bcrypt.compare(senha, conta?.senhaHash ?? HASH_FALSO);
      if (!conta || !confere) return false;
      achado.usuario = { id: conta.id, sessaoVersao: conta.sessaoVersao };
      return true;
    },
    agora,
  );

  if (resultado === "espere") return { certo: false, erro: RECADO_DE_ESPERA };
  if (resultado === "errada" || !achado.usuario) {
    return { certo: false, erro: RECADO_DE_SENHA_ERRADA };
  }
  return { certo: true, usuario: achado.usuario };
}
