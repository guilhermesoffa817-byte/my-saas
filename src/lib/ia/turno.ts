import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import type { PrismaClient } from "@/generated/prisma";
import type { CotaDoAssistente, EventoAssistente, PedidoAoAssistente } from "@/lib/assistente/protocolo";
import { paraDataLocal } from "@/lib/formato";

import {
  agruparPorPergunta,
  AVISO_DE_CORTE,
  AVISO_DE_VOLTAS,
  historicoParaApi,
  MAX_CHAMADAS_POR_PERGUNTA,
  MAX_PERGUNTAS_POR_CONVERSA,
  MAX_VOLTAS,
  MENSAGEM_DE_RECUSA,
  rodarVolta,
  tituloDaConversa,
  type LinhaDeMensagem,
} from "./assistente";
import {
  acrescentarPergunta,
  ConflitoNaConversa,
  contarChamada,
  conversaDoUsuario,
  criarConversaComPergunta,
  descartarPergunta,
  fecharPergunta,
  gravarVolta,
  linhasDaConversa,
  perguntaDoUsuario,
  perguntasNaConversa,
  type Fechamento,
} from "./conversas";
import { executarFerramenta, ferramentasDaApi, statusDaFerramenta } from "./ferramentas";
import { cotaDeIa, devolverUsoDeIa, reservarUsoDeIa, somarAoUsoDeIa } from "./franquia";
import { cidadeDoEstudio, mensagemDoUsuario, montarSistema } from "./sistema";

/**
 * O que um pedido a POST /api/assistente faz, do começo ao fim, fora da rota
 * para os testes rodarem com o banco de teste e uma API falsa.
 *
 * Cada pedido faz no máximo UMA chamada à IA. Na Netlify uma função pode ser
 * cortada em cerca de 10 segundos; uma resposta com várias consultas e uma
 * pesquisa na web não cabe nisso. Então:
 *
 * - "perguntar" reserva a franquia (uma vez por pergunta), grava a pergunta e
 *   faz a primeira volta;
 * - cada volta grava o que voltou, roda as ferramentas pedidas e grava os
 *   resultados, tudo junto, e diz à tela se falta outra volta;
 * - "continuar" lê do banco onde a pergunta parou e faz a próxima volta. Se um
 *   pedido foi cortado no meio, nada dele ficou gravado, e a próxima chamada
 *   retoma da última volta completa.
 */

export type EstudioDoAssistente = {
  id: string;
  ramo: string | null;
  /** A cidade do cadastro do Pix: a única cidade que o Bossa guarda. */
  pixCidade: string | null;
};

export type OpcoesDoPedido = {
  db: PrismaClient;
  estudio: EstudioDoAssistente;
  pedido: PedidoAoAssistente;
  /** Perguntas por mês que o plano dá. */
  limite: number;
  emitir: (evento: EventoAssistente) => void;
  /** O navegador saiu ou o prazo do pedido venceu. */
  signal?: AbortSignal;
  agora?: Date;
  /** Para testes. */
  cliente?: Anthropic;
  modelo?: string;
};

function erro(emitir: OpcoesDoPedido["emitir"], codigo: string, mensagem: string, repetivel = false) {
  emitir({ tipo: "erro", codigo, mensagem, repetivel });
}

async function cotaAtual(op: OpcoesDoPedido): Promise<CotaDoAssistente | null> {
  try {
    const cota = await cotaDeIa(op.db, op.estudio.id, "assistente", op.limite, op.agora);
    return { usados: cota.usados, limite: cota.limite };
  } catch {
    return null;
  }
}

async function terminar(op: OpcoesDoPedido, salvo: boolean, continuar: boolean) {
  op.emitir({ tipo: "fim", salvo, continuar, cota: await cotaAtual(op) });
}

/** Ponto de entrada: atende um pedido e emite os eventos, sempre terminando em "fim". */
export async function atenderPedido(op: OpcoesDoPedido): Promise<void> {
  try {
    if (op.pedido.acao === "perguntar") await perguntar(op, op.pedido);
    else await continuar(op, op.pedido.conversaId);
  } catch (e) {
    if (e instanceof ConflitoNaConversa) erro(op.emitir, "conflito", e.message);
    else erro(op.emitir, "gravar", "Não foi possível gravar a conversa. Tente de novo.", true);
    await terminar(op, false, false);
  }
}

async function perguntar(op: OpcoesDoPedido, pedido: Extract<PedidoAoAssistente, { acao: "perguntar" }>) {
  const { db, estudio } = op;
  const agora = op.agora ?? new Date();

  // Conversa existente: sempre do estúdio da sessão.
  let conversa: Awaited<ReturnType<typeof conversaDoUsuario>> = null;
  let linhas: LinhaDeMensagem[] = [];
  if (pedido.conversaId) {
    conversa = await conversaDoUsuario(db, estudio.id, pedido.conversaId);
    if (!conversa) {
      erro(op.emitir, "nao_encontrada", "Conversa não encontrada. Comece uma nova conversa.");
      return terminar(op, false, false);
    }
    linhas = await linhasDaConversa(db, estudio.id, conversa.id);
    if (perguntasNaConversa(linhas) >= MAX_PERGUNTAS_POR_CONVERSA) {
      erro(op.emitir, "conversa_longa", "Esta conversa ficou longa. Comece uma nova conversa para continuar.");
      return terminar(op, false, false);
    }
    // Uma pergunta anterior que ficou pela metade é encerrada antes da nova.
    const anterior = agruparPorPergunta(linhas).at(-1)?.pergunta;
    if (anterior?.situacao === "andamento") {
      await fecharPergunta(db, {
        usuarioId: estudio.id,
        conversaId: conversa.id,
        perguntaId: anterior.id,
        situacao: "interrompida",
      });
    }
  }

  // Franquia: uma pergunta, reservada ANTES de chamar a API e só aqui.
  const reserva = await reservarUsoDeIa(db, {
    usuarioId: estudio.id,
    recurso: "assistente",
    limite: op.limite,
    agora,
  });
  if (!reserva.ok) {
    erro(
      op.emitir,
      "cota",
      `Você já usou as ${op.limite} perguntas ao assistente que o plano inclui neste mês. A franquia renova no dia 1º.`,
    );
    return terminar(op, false, false);
  }

  const mensagem: Anthropic.Beta.BetaMessageParam = {
    role: "user",
    content: [{ type: "text", text: mensagemDoUsuario(pedido.pergunta, paraDataLocal(agora)) }],
  };
  const pergunta = { mensagem, texto: pedido.pergunta, usoDeIaId: reserva.id };

  let conversaId: string;
  let titulo: string;
  try {
    if (conversa) {
      const ordem = (linhas.at(-1)?.ordem ?? -1) + 1;
      await acrescentarPergunta(db, { usuarioId: estudio.id, conversaId: conversa.id, ordem, pergunta });
      conversaId = conversa.id;
      titulo = conversa.titulo;
    } else {
      const cidade = cidadeDoEstudio(estudio.pixCidade);
      const nova = await criarConversaComPergunta(db, {
        usuarioId: estudio.id,
        titulo: tituloDaConversa(pedido.pergunta),
        sistema: montarSistema({ ramo: estudio.ramo, cidade }),
        ferramentas: ferramentasDaApi({ cidade }),
        pergunta,
      });
      conversaId = nova.id;
      titulo = nova.titulo;
    }
  } catch (e) {
    // A API nem foi chamada: a pergunta volta para a franquia.
    await devolverUsoDeIa(db, { id: reserva.id, usuarioId: estudio.id, unidades: 1 });
    throw e;
  }

  op.emitir({ tipo: "inicio", conversaId, titulo, nova: !conversa });
  const gravada = await conversaDoUsuario(db, estudio.id, conversaId);
  if (!gravada) throw new ConflitoNaConversa();
  await proximaVolta(op, gravada);
}

async function continuar(op: OpcoesDoPedido, conversaId: string) {
  const conversa = await conversaDoUsuario(op.db, op.estudio.id, conversaId);
  if (!conversa) {
    erro(op.emitir, "nao_encontrada", "Conversa não encontrada. Comece uma nova conversa.");
    return terminar(op, false, false);
  }
  op.emitir({ tipo: "inicio", conversaId, titulo: conversa.titulo, nova: false });
  await proximaVolta(op, conversa);
}

type ConversaGravada = NonNullable<Awaited<ReturnType<typeof conversaDoUsuario>>>;

/** Faz a próxima volta da pergunta em andamento, se houver uma. */
async function proximaVolta(op: OpcoesDoPedido, conversa: ConversaGravada) {
  const { db, estudio } = op;
  const conversaId = conversa.id;
  const linhas = await linhasDaConversa(db, estudio.id, conversaId);
  const grupo = agruparPorPergunta(linhas).at(-1);
  if (!grupo || grupo.pergunta.situacao !== "andamento") return terminar(op, true, false);

  const { pergunta } = grupo;
  const fechar = (situacao: Fechamento) =>
    fecharPergunta(db, { usuarioId: estudio.id, conversaId, perguntaId: pergunta.id, situacao });

  const respostas = grupo.mensagens.filter((m) => m.papel === "assistant" && !m.descartada);
  const ultima = grupo.mensagens.at(-1)!;
  // Já respondida (não deveria acontecer: a situação é gravada junto com a resposta).
  if (ultima.papel === "assistant" && ultima.motivoParada !== "pause_turn") {
    await fechar("concluida");
    return terminar(op, true, false);
  }
  if (respostas.length >= MAX_VOLTAS) {
    await fechar("voltas");
    op.emitir({ tipo: "aviso", mensagem: AVISO_DE_VOLTAS });
    return terminar(op, true, false);
  }

  const reservaDaPergunta = await perguntaDoUsuario(db, estudio.id, pergunta.id);
  if (!(await contarChamada(db, { usuarioId: estudio.id, perguntaId: pergunta.id, maximo: MAX_CHAMADAS_POR_PERGUNTA }))) {
    await fechar("erro");
    erro(op.emitir, "tentativas", "Esta resposta já teve tentativas demais. Faça a pergunta de novo, de um jeito mais curto.");
    return terminar(op, false, false);
  }

  const resultado = await rodarVolta({
    sistema: conversa.sistema,
    ferramentas: JSON.parse(conversa.ferramentas) as Anthropic.Beta.BetaToolUnion[],
    mensagens: historicoParaApi(linhas, true),
    emitir: op.emitir,
    statusDe: statusDaFerramenta,
    signal: op.signal,
    cliente: op.cliente,
    modelo: op.modelo,
  });

  // Os tokens gastos ficam registrados mesmo quando a volta não é gravada.
  if ((resultado.tipo === "resposta" || resultado.tipo === "recusa") && reservaDaPergunta?.usoDeIaId) {
    await somarAoUsoDeIa(db, { id: reservaDaPergunta.usoDeIaId, usuarioId: estudio.id, uso: resultado.uso });
  }

  if (resultado.tipo === "cancelado") {
    // A pessoa parou ou saiu da página: a pergunta fica em andamento e pode continuar depois.
    return terminar(op, false, false);
  }

  if (resultado.tipo === "erro") {
    const historicoLongo = linhas.length > 1;
    const naoAdianta = !resultado.erro.repetivel;
    if (naoAdianta) await fechar("erro");
    const mensagem =
      resultado.erro.codigo === "pedido" && historicoLongo
        ? "Não foi possível continuar esta conversa. Comece uma nova conversa e refaça a pergunta."
        : resultado.erro.mensagem;
    erro(op.emitir, resultado.erro.codigo, mensagem, resultado.erro.repetivel);
    return terminar(op, false, false);
  }

  if (resultado.tipo === "recusa") {
    await descartarPergunta(db, {
      usuarioId: estudio.id,
      conversaId,
      perguntaId: pergunta.id,
      ordem: pergunta.ordem,
    });
    op.emitir({ tipo: "recusa", mensagem: MENSAGEM_DE_RECUSA });
    return terminar(op, false, false);
  }

  const ordem = ultima.ordem + 1;
  const voltas = respostas.length + 1;
  const { motivo, conteudo, pedidos } = resultado;
  const resposta = { conteudo, motivo };

  if (motivo === "tool_use" && pedidos.length > 0) {
    const hoje = paraDataLocal(op.agora ?? new Date());
    const resultados = await Promise.all(
      pedidos.map((bloco) => executarFerramenta(bloco, { db, usuarioId: estudio.id, hoje })),
    );
    const acabou = voltas >= MAX_VOLTAS;
    await gravarVolta(db, {
      usuarioId: estudio.id,
      conversaId,
      perguntaId: pergunta.id,
      ordem,
      resposta,
      resultados,
      ...(acabou ? { fechar: "voltas" as const } : {}),
    });
    if (acabou) op.emitir({ tipo: "aviso", mensagem: AVISO_DE_VOLTAS });
    return terminar(op, true, !acabou);
  }

  if (motivo === "pause_turn") {
    const acabou = voltas >= MAX_VOLTAS;
    await gravarVolta(db, {
      usuarioId: estudio.id,
      conversaId,
      perguntaId: pergunta.id,
      ordem,
      resposta,
      ...(acabou ? { fechar: "voltas" as const } : {}),
    });
    if (acabou) op.emitir({ tipo: "aviso", mensagem: AVISO_DE_VOLTAS });
    return terminar(op, true, !acabou);
  }

  if (motivo === "max_tokens" || motivo === "model_context_window_exceeded") {
    // Grava como veio; o tool_use cortado nunca roda, e sai do histórico
    // (fecharPendencias) quando a próxima pergunta for montada.
    await gravarVolta(db, { usuarioId: estudio.id, conversaId, perguntaId: pergunta.id, ordem, resposta, fechar: "cortada" });
    op.emitir({ tipo: "aviso", mensagem: AVISO_DE_CORTE });
    return terminar(op, true, false);
  }

  await gravarVolta(db, { usuarioId: estudio.id, conversaId, perguntaId: pergunta.id, ordem, resposta, fechar: "concluida" });
  return terminar(op, true, false);
}
