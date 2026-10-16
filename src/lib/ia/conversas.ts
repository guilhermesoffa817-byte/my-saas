import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { Prisma, type PrismaClient } from "@/generated/prisma";
import type { ConversaDaLista } from "@/lib/assistente/protocolo";

import { textoVisivel, type LinhaDeMensagem } from "./assistente";

/**
 * Leitura e gravação das conversas do assistente.
 *
 * Toda consulta filtra pelo estúdio da sessão (`usuarioId`), inclusive as das
 * mensagens: um id de conversa vindo do navegador nunca é usado sozinho. O
 * histórico só cresce por acréscimo; a única coisa que muda numa mensagem
 * gravada é a situação da pergunta e a marca de descartada, que não vão à API.
 */

type Banco = PrismaClient;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;

export const CONVERSAS_NA_LISTA = 50;
/** [EXEMPLO] Conversa parada há mais que isso é apagada quando a tela abre. */
export const DIAS_DE_RETENCAO = 90;

export async function listarConversas(db: Banco, usuarioId: string): Promise<ConversaDaLista[]> {
  const conversas = await db.conversaDeIa.findMany({
    where: { usuarioId },
    orderBy: { atualizadoEm: "desc" },
    take: CONVERSAS_NA_LISTA,
    select: { id: true, titulo: true, atualizadoEm: true },
  });
  return conversas.map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.atualizadoEm.toISOString() }));
}

export async function conversaDoUsuario(db: Banco, usuarioId: string, conversaId: string) {
  return db.conversaDeIa.findFirst({
    where: { id: conversaId, usuarioId },
    select: { id: true, titulo: true, sistema: true, ferramentas: true },
  });
}

function lerConteudo(texto: string): BetaMessageParam["content"] {
  // Gravado por nós mesmos com JSON.stringify: a ordem das chaves volta igual.
  return JSON.parse(texto) as BetaMessageParam["content"];
}

/** As mensagens da conversa, em ordem, com o conteúdo como foi enviado à API. Só no servidor. */
export async function linhasDaConversa(db: Banco, usuarioId: string, conversaId: string): Promise<LinhaDeMensagem[]> {
  const linhas = await db.mensagemDeIa.findMany({
    where: { conversaId, usuarioId },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      ordem: true,
      papel: true,
      conteudo: true,
      textoNaTela: true,
      motivoParada: true,
      situacao: true,
      descartada: true,
    },
  });
  return linhas.map((l) => ({
    ...l,
    papel: l.papel === "assistant" ? "assistant" : "user",
    conteudo: lerConteudo(l.conteudo),
  }));
}

/** A pergunta de uma linha, com o que o servidor precisa saber dela. */
export async function perguntaDoUsuario(db: Banco, usuarioId: string, perguntaId: string) {
  return db.mensagemDeIa.findFirst({
    where: { id: perguntaId, usuarioId, papel: "user", situacao: { not: null } },
    select: { id: true, conversaId: true, situacao: true, usoDeIaId: true, chamadas: true, ordem: true },
  });
}

export function perguntasNaConversa(linhas: LinhaDeMensagem[]) {
  return linhas.filter((l) => l.papel === "user" && l.situacao !== null).length;
}

/** Erro de gravação que a tela precisa ler como veio. */
export class ConflitoNaConversa extends Error {
  constructor() {
    super("A conversa mudou em outra aba. Recarregue a página.");
  }
}

function ehConflito(erro: unknown) {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

/**
 * Cria a conversa já com a primeira pergunta. O sistema e as ferramentas
 * ficam congelados nela: a API amarra o raciocínio guardado aos dois.
 */
export async function criarConversaComPergunta(
  db: Banco,
  params: {
    usuarioId: string;
    titulo: string;
    sistema: string;
    ferramentas: Anthropic.Beta.BetaToolUnion[];
    pergunta: { mensagem: BetaMessageParam; texto: string; usoDeIaId: string };
  },
) {
  return db.conversaDeIa.create({
    data: {
      usuarioId: params.usuarioId,
      titulo: params.titulo,
      sistema: params.sistema,
      ferramentas: JSON.stringify(params.ferramentas),
      mensagens: {
        create: {
          usuarioId: params.usuarioId,
          ordem: 0,
          papel: "user",
          conteudo: JSON.stringify(params.pergunta.mensagem.content),
          textoNaTela: params.pergunta.texto,
          situacao: "andamento",
          usoDeIaId: params.pergunta.usoDeIaId,
        },
      },
    },
    select: { id: true, titulo: true },
  });
}

/** Acrescenta uma pergunta a uma conversa que já existe. */
export async function acrescentarPergunta(
  db: Banco,
  params: {
    usuarioId: string;
    conversaId: string;
    ordem: number;
    pergunta: { mensagem: BetaMessageParam; texto: string; usoDeIaId: string };
  },
) {
  try {
    return await db.$transaction(async (tx) => {
      const conversa = await tx.conversaDeIa.updateMany({
        where: { id: params.conversaId, usuarioId: params.usuarioId },
        data: { atualizadoEm: new Date() },
      });
      if (conversa.count === 0) throw new ConflitoNaConversa();
      return tx.mensagemDeIa.create({
        data: {
          usuarioId: params.usuarioId,
          conversaId: params.conversaId,
          ordem: params.ordem,
          papel: "user",
          conteudo: JSON.stringify(params.pergunta.mensagem.content),
          textoNaTela: params.pergunta.texto,
          situacao: "andamento",
          usoDeIaId: params.pergunta.usoDeIaId,
        },
        select: { id: true },
      });
    });
  } catch (erro) {
    if (ehConflito(erro)) throw new ConflitoNaConversa();
    throw erro;
  }
}

/**
 * Situações de fim de pergunta. "recusada" tem caminho próprio (`descartarPergunta`).
 */
export type Fechamento = "concluida" | "cortada" | "voltas" | "interrompida" | "erro";

/**
 * Grava o resultado de uma volta, tudo ou nada: a resposta do assistente, os
 * resultados das ferramentas (se houver) e, quando a pergunta acabou, a
 * situação dela. A posição (`ordem`) é única por conversa: se outro pedido
 * gravou antes, este é recusado em vez de embaralhar o histórico.
 */
export async function gravarVolta(
  db: Banco,
  params: {
    usuarioId: string;
    conversaId: string;
    perguntaId: string;
    /** A ordem da primeira mensagem nova: a última lida + 1. */
    ordem: number;
    resposta: { conteudo: Anthropic.Beta.BetaContentBlock[]; motivo: string };
    resultados?: Anthropic.Beta.BetaToolResultBlockParam[];
    fechar?: Fechamento;
  },
) {
  try {
    await db.$transaction(async (tx) => {
      const conversa = await tx.conversaDeIa.updateMany({
        where: { id: params.conversaId, usuarioId: params.usuarioId },
        data: { atualizadoEm: new Date() },
      });
      if (conversa.count === 0) throw new ConflitoNaConversa();

      await tx.mensagemDeIa.create({
        data: {
          usuarioId: params.usuarioId,
          conversaId: params.conversaId,
          ordem: params.ordem,
          papel: "assistant",
          conteudo: JSON.stringify(params.resposta.conteudo),
          textoNaTela: textoVisivel(params.resposta.conteudo) || null,
          motivoParada: params.resposta.motivo,
        },
      });
      if (params.resultados?.length) {
        await tx.mensagemDeIa.create({
          data: {
            usuarioId: params.usuarioId,
            conversaId: params.conversaId,
            ordem: params.ordem + 1,
            papel: "user",
            conteudo: JSON.stringify(params.resultados),
          },
        });
      }
      if (params.fechar) {
        const fechou = await tx.mensagemDeIa.updateMany({
          where: { id: params.perguntaId, usuarioId: params.usuarioId, situacao: "andamento" },
          data: { situacao: params.fechar },
        });
        if (fechou.count === 0) throw new ConflitoNaConversa();
      }
    });
  } catch (erro) {
    if (ehConflito(erro)) throw new ConflitoNaConversa();
    throw erro;
  }
}

/**
 * Encerra uma pergunta que não vai mais andar. Se ela não chegou a ter
 * resposta gravada, sai do histórico (descartada): senão a próxima pergunta
 * iria para a API colada nela.
 */
export async function fecharPergunta(
  db: Banco,
  params: { usuarioId: string; conversaId: string; perguntaId: string; situacao: Fechamento },
) {
  const pergunta = await db.mensagemDeIa.findFirst({
    where: { id: params.perguntaId, usuarioId: params.usuarioId, conversaId: params.conversaId },
    select: { ordem: true },
  });
  if (!pergunta) return false;
  const respostas = await db.mensagemDeIa.count({
    where: {
      conversaId: params.conversaId,
      usuarioId: params.usuarioId,
      papel: "assistant",
      ordem: { gt: pergunta.ordem },
      descartada: false,
    },
  });
  const mudou = await db.mensagemDeIa.updateMany({
    where: { id: params.perguntaId, usuarioId: params.usuarioId, situacao: "andamento" },
    data: { situacao: params.situacao, ...(respostas === 0 ? { descartada: true } : {}) },
  });
  return mudou.count > 0;
}

/**
 * A IA recusou: a pergunta e tudo o que veio depois dela saem do histórico
 * enviado à API (ficam marcadas como descartadas). A conversa continua
 * exatamente como estava antes da pergunta.
 */
export async function descartarPergunta(
  db: Banco,
  params: { usuarioId: string; conversaId: string; perguntaId: string; ordem: number },
) {
  await db.$transaction([
    db.mensagemDeIa.updateMany({
      where: { conversaId: params.conversaId, usuarioId: params.usuarioId, ordem: { gte: params.ordem } },
      data: { descartada: true },
    }),
    db.mensagemDeIa.updateMany({
      where: { id: params.perguntaId, usuarioId: params.usuarioId },
      data: { situacao: "recusada" },
    }),
  ]);
}

/**
 * Conta mais uma chamada à API para a pergunta, se ela ainda está em
 * andamento e não passou do teto. Atômico: dois pedidos ao mesmo tempo não
 * passam juntos do limite.
 */
export async function contarChamada(
  db: Banco,
  params: { usuarioId: string; perguntaId: string; maximo: number },
) {
  const mudou = await db.mensagemDeIa.updateMany({
    where: {
      id: params.perguntaId,
      usuarioId: params.usuarioId,
      situacao: "andamento",
      chamadas: { lt: params.maximo },
    },
    data: { chamadas: { increment: 1 } },
  });
  return mudou.count > 0;
}

export async function apagarConversa(db: Banco, usuarioId: string, conversaId: string) {
  const apagou = await db.conversaDeIa.deleteMany({ where: { id: conversaId, usuarioId } });
  return apagou.count > 0;
}

/**
 * Retenção: apaga as conversas do estúdio paradas há mais de 90 dias. Roda
 * quando a tela abre, sem tarefa agendada. As mensagens saem junto (cascata).
 */
export async function apagarConversasParadas(db: Banco, usuarioId: string, agora = new Date()) {
  const limite = new Date(agora.getTime() - DIAS_DE_RETENCAO * 86_400_000);
  const apagou = await db.conversaDeIa.deleteMany({ where: { usuarioId, atualizadoEm: { lt: limite } } });
  return apagou.count;
}

/** A dona leu o aviso e aceitou. Aceitar de novo não muda a data do primeiro aceite. */
export async function aceitarAvisoDaIa(db: Banco, usuarioId: string, agora = new Date()) {
  await db.usuario.updateMany({ where: { id: usuarioId, iaAceitaEm: null }, data: { iaAceitaEm: agora } });
}
