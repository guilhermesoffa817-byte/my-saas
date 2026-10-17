import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import type { EventoAssistente, FonteDaResposta, MensagemDaTela } from "@/lib/assistente/protocolo";

import { anthropic, fallbackDoModelo, modeloDaIa, traduzirErroIA, type ErroIA } from "./cliente";
import type { UsoDaApi } from "./franquia";
import { sanitizarParaIA } from "./sanitizar";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
type BlocoDaMensagem = Exclude<BetaMessageParam["content"], string>[number];

export { MAX_VOLTAS } from "@/lib/assistente/protocolo";

/** Cabe o raciocínio e a resposta. */
export const MAX_TOKENS = 32_000;
/** Perguntas por conversa: depois disso o contexto fica caro e a conversa pede recomeço. */
export const MAX_PERGUNTAS_POR_CONVERSA = 20;
/**
 * Chamadas à API por pergunta, contando as repetidas depois de um erro ou de
 * um corte da hospedagem. Sem esse teto, um "tentar de novo" sem fim gastaria
 * dinheiro sem gastar franquia.
 */
export const MAX_CHAMADAS_POR_PERGUNTA = 12;
export const TAMANHO_DO_TITULO = 80;

export const MENSAGEM_DE_RECUSA =
  "O assistente não pode ajudar com esse pedido. Reformule a pergunta com foco nos números do negócio ou, se for sobre impostos, fale com seu contador.";
export const AVISO_DE_VOLTAS =
  "A análise ficou longa demais e parou antes do fim. Tente uma pergunta mais específica, com um período menor.";
export const AVISO_DE_CORTE =
  "A resposta foi cortada por tamanho. Peça a continuação ou faça uma pergunta mais específica.";
export const AVISO_DE_INTERRUPCAO = "Resposta interrompida antes do fim.";
export const AVISO_DE_ERRO = "Não foi possível terminar esta resposta.";
export const AVISO_DE_METADE = "A resposta ficou pela metade.";

/** Título da conversa: a primeira pergunta, limpa de documento e contato, e curta. */
export function tituloDaConversa(pergunta: string) {
  const limpo = sanitizarParaIA(pergunta.replace(/\s+/g, " ").trim());
  if (!limpo) return "Nova conversa";
  if (limpo.length <= TAMANHO_DO_TITULO) return limpo;
  return `${limpo.slice(0, TAMANHO_DO_TITULO - 1).trimEnd()}…`;
}

/**
 * Depois de um fallback no meio da resposta (o modelo recusou e outro
 * continuou): antes do último bloco `fallback`, tira raciocínio, tool_use e
 * server_tool_use sem resultado, como a API pede para reenviar.
 */
export function prepararParaReenvio(content: BetaContentBlock[]): BetaContentBlock[] {
  const corte = content.findLastIndex((b) => b.type === "fallback");
  if (corte < 0) return content;
  const antes = content.slice(0, corte);
  const comResultado = new Set(antes.flatMap((b) => ("tool_use_id" in b ? [b.tool_use_id] : [])));
  const limpos = antes.filter((b) => {
    if (b.type === "thinking" || b.type === "redacted_thinking" || b.type === "tool_use") return false;
    if (b.type === "server_tool_use") return comResultado.has(b.id);
    return true;
  });
  return [...limpos, ...content.slice(corte)];
}

/**
 * O texto que a tela mostra de uma resposta (nunca o raciocínio). Blocos de
 * texto colados são pedaços da mesma frase (as citações quebram o texto);
 * texto que volta depois de uma ferramenta começa parágrafo novo. A tela faz a
 * mesma conta enquanto o texto chega, então o que se vê ao vivo e o que se vê
 * ao reabrir a conversa são iguais.
 */
export function textoVisivel(content: BetaMessageParam["content"]) {
  if (typeof content === "string") return content.trim();
  let texto = "";
  let anteriorFoiTexto = false;
  for (const bloco of content) {
    if (bloco.type === "text") {
      if (texto && !anteriorFoiTexto) texto += "\n\n";
      texto += bloco.text;
      anteriorFoiTexto = true;
    } else anteriorFoiTexto = false;
  }
  return texto.trim();
}

/** Só links https: a tela não mostra outro tipo de endereço vindo do modelo. */
export function urlSegura(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Fontes citadas nos blocos de texto, sem repetir endereço. */
export function fontesDoConteudo(content: BetaMessageParam["content"]): FonteDaResposta[] {
  if (typeof content === "string") return [];
  const vistas = new Map<string, FonteDaResposta>();
  for (const bloco of content) {
    if (bloco.type !== "text" || !bloco.citations) continue;
    for (const c of bloco.citations) {
      if (c.type === "web_search_result_location" && urlSegura(c.url) && !vistas.has(c.url)) {
        vistas.set(c.url, { url: c.url, titulo: c.title ?? null });
      }
    }
  }
  return [...vistas.values()];
}

/* -------------------------------------------------------------- histórico */

/** Uma linha de MensagemDeIa, com o conteúdo já lido do texto JSON. */
export type LinhaDeMensagem = {
  id: string;
  ordem: number;
  papel: "user" | "assistant";
  conteudo: BetaMessageParam["content"];
  textoNaTela: string | null;
  motivoParada: string | null;
  /** Preenchida só na pergunta. */
  situacao: string | null;
  descartada: boolean;
};

export const ehPergunta = (linha: LinhaDeMensagem) => linha.papel === "user" && linha.situacao !== null;

/** Cada pergunta com as mensagens que vieram depois dela. */
export function agruparPorPergunta(linhas: LinhaDeMensagem[]) {
  const grupos: { pergunta: LinhaDeMensagem; mensagens: LinhaDeMensagem[] }[] = [];
  for (const linha of linhas) {
    if (ehPergunta(linha)) grupos.push({ pergunta: linha, mensagens: [linha] });
    else grupos.at(-1)?.mensagens.push(linha);
  }
  return grupos;
}

const ehRaciocinio = (b: BlocoDaMensagem) => b.type === "thinking" || b.type === "redacted_thinking";
const idsDeResultado = (m: BetaMessageParam) =>
  typeof m.content === "string" ? [] : m.content.flatMap((b) => ("tool_use_id" in b ? [b.tool_use_id] : []));

/**
 * Fecha as pendências de uma pergunta encerrada (cortada, longa demais,
 * interrompida): em cada sequência de respostas do assistente, tira os
 * `tool_use` sem `tool_result` logo depois e os `server_tool_use` sem
 * resultado. Sem isso, a pergunta seguinte da conversa daria erro 400.
 * Numa resposta que precisou mudar, o raciocínio também sai; se não sobrar
 * nada, ela sai inteira. O que não tem pendência não muda: os bytes enviados
 * à API continuam os mesmos de sempre.
 */
export function fecharPendencias(mensagens: BetaMessageParam[]): BetaMessageParam[] {
  const saida: BetaMessageParam[] = [];
  let i = 0;
  while (i < mensagens.length) {
    if (mensagens[i].role !== "assistant") {
      saida.push(mensagens[i]);
      i += 1;
      continue;
    }
    let fim = i;
    while (fim + 1 < mensagens.length && mensagens[fim + 1].role === "assistant") fim += 1;
    const sequencia = mensagens.slice(i, fim + 1);
    const seguinte = mensagens[fim + 1];
    const respondidos = new Set([
      ...sequencia.flatMap(idsDeResultado),
      ...(seguinte?.role === "user" ? idsDeResultado(seguinte) : []),
    ]);
    const pendente = (b: BlocoDaMensagem) =>
      (b.type === "tool_use" || b.type === "server_tool_use") && !respondidos.has(b.id);

    for (const m of sequencia) {
      if (typeof m.content === "string" || !m.content.some(pendente)) {
        saida.push(m);
        continue;
      }
      // A mensagem mudou: o raciocínio dela sai junto. A API amarra o raciocínio
      // à mensagem em que nasceu, e reenviar raciocínio de mensagem editada é
      // recusado; sem ele, não há o que conferir.
      const content = m.content.filter((b) => !pendente(b) && !ehRaciocinio(b));
      if (content.length > 0) saida.push({ ...m, content });
    }
    i = fim + 1;
  }
  return saida;
}

/**
 * O histórico como vai para a API, montado do banco. Mensagens descartadas
 * (pergunta recusada ou sem resposta) ficam de fora. As perguntas encerradas
 * passam por `fecharPendencias`; a pergunta em andamento, quando
 * `ultimaEmAndamento`, vai intacta, porque a retomada de um pause_turn precisa
 * do server_tool_use pendente.
 */
export function historicoParaApi(linhas: LinhaDeMensagem[], ultimaEmAndamento: boolean): BetaMessageParam[] {
  const grupos = agruparPorPergunta(linhas.filter((l) => !l.descartada));
  return grupos.flatMap((grupo, indice) => {
    const mensagens = grupo.mensagens.map((l): BetaMessageParam => ({ role: l.papel, content: l.conteudo }));
    const aberta = ultimaEmAndamento && indice === grupos.length - 1;
    return aberta ? mensagens : fecharPendencias(mensagens);
  });
}

const AVISO_DA_SITUACAO: Record<string, string> = {
  recusada: MENSAGEM_DE_RECUSA,
  cortada: AVISO_DE_CORTE,
  voltas: AVISO_DE_VOLTAS,
  interrompida: AVISO_DE_INTERRUPCAO,
  erro: AVISO_DE_ERRO,
};

/**
 * O que a tela mostra de uma conversa gravada: cada pergunta e a resposta
 * inteira (todas as voltas juntas). Raciocínio e resultado de ferramenta
 * ficam de fora, e de uma pergunta recusada só aparece o recado.
 */
export function mensagensParaTela(linhas: LinhaDeMensagem[]): MensagemDaTela[] {
  const tela: MensagemDaTela[] = [];
  for (const { pergunta, mensagens } of agruparPorPergunta(linhas)) {
    tela.push({ id: pergunta.id, papel: "usuario", texto: pergunta.textoNaTela ?? "", fontes: [] });

    const respostas =
      pergunta.situacao === "recusada" ? [] : mensagens.filter((m) => m.papel === "assistant" && !m.descartada);
    const texto = respostas
      .map((m) => (m.textoNaTela ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
    const fontes: FonteDaResposta[] = [];
    for (const m of respostas) {
      for (const f of fontesDoConteudo(m.conteudo)) if (!fontes.some((g) => g.url === f.url)) fontes.push(f);
    }
    const emAndamento = pergunta.situacao === "andamento";
    const aviso = emAndamento ? AVISO_DE_METADE : AVISO_DA_SITUACAO[pergunta.situacao ?? ""];
    if (!texto && fontes.length === 0 && !aviso) continue;
    tela.push({
      id: `r-${pergunta.id}`,
      papel: "assistente",
      texto,
      fontes,
      ...(aviso ? { aviso } : {}),
      ...(emAndamento ? { podeContinuar: true } : {}),
    });
  }
  return tela;
}

/* ------------------------------------------------------------- uma volta */

export type ResultadoDaVolta =
  | {
      tipo: "resposta";
      motivo: string;
      /** Os blocos como voltaram (depois de `prepararParaReenvio`), para gravar. */
      conteudo: BetaContentBlock[];
      /** Ferramentas pedidas. Só valem quando o motivo é tool_use. */
      pedidos: BetaToolUseBlock[];
      uso: UsoDaApi;
    }
  /** A cadeia de fallback inteira recusou. Nada desta pergunta é gravado. */
  | { tipo: "recusa"; uso: UsoDaApi }
  | { tipo: "erro"; erro: ErroIA }
  | { tipo: "cancelado" };

export type OpcoesDaVolta = {
  /** Gravado na conversa: o mesmo em todos os pedidos dela. */
  sistema: string;
  /** Idem. */
  ferramentas: Anthropic.Beta.BetaToolUnion[];
  /** Histórico do banco, terminando numa mensagem do usuário ou num pause_turn. */
  mensagens: BetaMessageParam[];
  emitir: (evento: EventoAssistente) => void;
  /** Texto curto para a tela enquanto uma ferramenta roda. */
  statusDe: (nome: string) => string | null;
  /** O navegador saiu, ou o prazo do pedido venceu. */
  signal?: AbortSignal;
  /** Para testes: um cliente com `fetch` falso. */
  cliente?: Anthropic;
  modelo?: string;
};

/**
 * UMA chamada à API, em streaming: manda o texto para a tela enquanto chega e
 * devolve o que voltou. Não grava nada e não roda ferramenta: quem chama
 * decide, porque o pedido inteiro precisa caber no tempo da hospedagem.
 */
export async function rodarVolta(opcoes: OpcoesDaVolta): Promise<ResultadoDaVolta> {
  const cliente = opcoes.cliente ?? anthropic();
  const modelo = opcoes.modelo ?? modeloDaIa();
  if (opcoes.signal?.aborted) return { tipo: "cancelado" };

  let houveTexto = false;
  let anteriorFoiTexto = false;
  const fontesEnviadas = new Set<string>();

  try {
    const stream = cliente.beta.messages.stream(
      {
        model: modelo,
        max_tokens: MAX_TOKENS,
        ...fallbackDoModelo(modelo),
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: opcoes.sistema,
        tools: opcoes.ferramentas,
        messages: opcoes.mensagens,
      },
      { signal: opcoes.signal },
    );

    stream.on("text", (delta) => {
      if (delta) opcoes.emitir({ tipo: "texto", delta });
    });
    stream.on("citation", (c) => {
      if (c.type !== "web_search_result_location" || !urlSegura(c.url) || fontesEnviadas.has(c.url)) return;
      fontesEnviadas.add(c.url);
      opcoes.emitir({ tipo: "fonte", url: c.url, titulo: c.title ?? null });
    });
    stream.on("streamEvent", (evento) => {
      if (evento.type !== "content_block_start") return;
      const bloco = evento.content_block;
      if (bloco.type === "text") {
        // Mesma regra de `textoVisivel`: texto depois de outro bloco abre parágrafo.
        if (houveTexto && !anteriorFoiTexto) opcoes.emitir({ tipo: "texto", delta: "\n\n" });
        houveTexto = true;
        anteriorFoiTexto = true;
        return;
      }
      anteriorFoiTexto = false;
      if (bloco.type === "tool_use" || bloco.type === "server_tool_use") {
        const mensagem = opcoes.statusDe(bloco.name);
        if (mensagem) opcoes.emitir({ tipo: "status", mensagem });
      }
    });

    const resposta = await stream.finalMessage();
    if (resposta.stop_reason === "refusal") return { tipo: "recusa", uso: resposta.usage };

    const conteudo = prepararParaReenvio(resposta.content);
    return {
      tipo: "resposta",
      motivo: resposta.stop_reason ?? "end_turn",
      conteudo,
      pedidos: conteudo.filter((b): b is BetaToolUseBlock => b.type === "tool_use"),
      uso: resposta.usage,
    };
  } catch (erro) {
    const traduzido = traduzirErroIA(erro);
    if (traduzido.codigo === "cancelado") {
      // Abortado pelo prazo do pedido, e não pela pessoa: vira erro de tempo.
      const motivo = opcoes.signal?.reason;
      if (motivo instanceof DOMException && motivo.name === "TimeoutError") {
        return {
          tipo: "erro",
          erro: { codigo: "tempo", mensagem: "A IA demorou demais para responder. Tente de novo.", repetivel: true },
        };
      }
      return { tipo: "cancelado" };
    }
    return { tipo: "erro", erro: traduzido };
  }
}
