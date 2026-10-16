import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { agendaEOcupacao } from "./ferramentas/agenda";
import type { ContextoFerramenta, Ferramenta } from "./ferramentas/base";
import { clientesEmNumeros } from "./ferramentas/clientes";
import { cobrancasEVencimentos } from "./ferramentas/cobrancas";
import { custosOperacionais } from "./ferramentas/custos";
import { equipeEmNumeros } from "./ferramentas/equipe";
import { resumoFinanceiro } from "./ferramentas/financeiro";
import { desempenhoDosServicos } from "./ferramentas/servicos";

export type { ContextoFerramenta } from "./ferramentas/base";

/**
 * As ferramentas do assistente. Todas só LEEM, e sempre do estúdio da sessão:
 * o `usuarioId` vem do servidor, nunca da entrada do modelo, que só escolhe
 * datas.
 *
 * A ordem e o texto daqui viram parte do pedido à API. A lista enviada fica
 * gravada em cada conversa quando ela nasce (ConversaDeIa.ferramentas), então
 * mudar algo aqui vale para as conversas novas sem quebrar as antigas.
 */
export const FERRAMENTAS = [
  resumoFinanceiro,
  desempenhoDosServicos,
  agendaEOcupacao,
  clientesEmNumeros,
  cobrancasEVencimentos,
  custosOperacionais,
  equipeEmNumeros,
] as Ferramenta[];

const PorNome = new Map(FERRAMENTAS.map((f) => [f.nome, f]));

export const NOME_DA_PESQUISA = "web_search";
export const MAXIMO_DE_PESQUISAS = 5;

/** O que a tela mostra enquanto cada ferramenta roda. */
export function statusDaFerramenta(nome: string) {
  if (nome === NOME_DA_PESQUISA) return "Pesquisando tendências…";
  return PorNome.get(nome)?.status ?? null;
}

/**
 * A lista enviada à API. A pesquisa na web recebe só a localização aproximada
 * (cidade e país) e nunca o nome do estúdio.
 */
export function ferramentasDaApi(estudio: { cidade: string | null }): Anthropic.Beta.BetaToolUnion[] {
  return [
    ...FERRAMENTAS.map((f) => ({
      name: f.nome,
      description: f.descricao,
      input_schema: f.esquema as Anthropic.Beta.BetaTool.InputSchema,
    })),
    {
      type: "web_search_20260209",
      name: NOME_DA_PESQUISA,
      max_uses: MAXIMO_DE_PESQUISAS,
      user_location: {
        type: "approximate",
        country: "BR",
        timezone: "America/Sao_Paulo",
        ...(estudio.cidade ? { city: estudio.cidade } : {}),
      },
    },
  ];
}

export type ResultadoDeFerramenta = Anthropic.Beta.BetaToolResultBlockParam;

/** Roda uma ferramenta pedida pelo modelo. Entrada inválida ou falha viram `is_error`, nunca exceção. */
export async function executarFerramenta(
  bloco: Pick<Anthropic.Beta.BetaToolUseBlock, "id" | "name" | "input">,
  ctx: ContextoFerramenta,
): Promise<ResultadoDeFerramenta> {
  const f = PorNome.get(bloco.name);
  if (!f) {
    return { type: "tool_result", tool_use_id: bloco.id, is_error: true, content: `Ferramenta desconhecida: ${bloco.name}.` };
  }
  const entrada = f.validar(bloco.input ?? {});
  if (!entrada.ok) {
    return { type: "tool_result", tool_use_id: bloco.id, is_error: true, content: `Entrada inválida: ${entrada.erro}` };
  }
  try {
    const dados = await f.executar(entrada.dados, ctx);
    return { type: "tool_result", tool_use_id: bloco.id, content: JSON.stringify(dados) };
  } catch {
    return {
      type: "tool_result",
      tool_use_id: bloco.id,
      is_error: true,
      content: "Falha ao consultar os dados do Bossa. Diga à pessoa que não foi possível ler esses números agora.",
    };
  }
}
