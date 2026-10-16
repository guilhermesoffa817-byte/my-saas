/**
 * O combinado entre a tela do assistente e POST /api/assistente: o corpo do
 * pedido e os eventos que voltam, um JSON por linha (NDJSON).
 *
 * Serve aos dois lados, então não importa nada do servidor.
 *
 * Por que o navegador conduz as voltas: na Netlify uma função pode ser cortada
 * em cerca de 10 segundos. Uma pergunta que consulta o financeiro, pesquisa na
 * web e só então responde passa disso com folga. Então cada pedido faz no
 * máximo UMA chamada à IA, grava o que voltou e diz se falta outra volta; a
 * tela pede a próxima até a resposta terminar.
 */

export const TAMANHO_MAXIMO_DA_PERGUNTA = 2000;

/** Voltas (chamadas à IA) por pergunta. O servidor confere do lado dele também. */
export const MAX_VOLTAS = 8;

export type PedidoAoAssistente =
  | { acao: "perguntar"; conversaId?: string; pergunta: string }
  | { acao: "continuar"; conversaId: string };

/** Ids do Prisma (cuid): letras minúsculas e números. Qualquer outra coisa é recusada. */
const ID = /^[a-z0-9]{10,40}$/;

export function idValido(valor: unknown): valor is string {
  return typeof valor === "string" && ID.test(valor);
}

/** Confere o corpo do pedido sem confiar em nada do que veio. */
export function lerPedido(
  corpo: unknown,
): { ok: true; pedido: PedidoAoAssistente } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido." };
  const { acao, conversaId, pergunta } = corpo as Record<string, unknown>;

  if (conversaId !== undefined && conversaId !== null && !idValido(conversaId)) {
    return { ok: false, erro: "Conversa inválida." };
  }
  const conversa = idValido(conversaId) ? conversaId : undefined;

  if (acao === "continuar") {
    if (!conversa) return { ok: false, erro: "Conversa inválida." };
    return { ok: true, pedido: { acao, conversaId: conversa } };
  }
  if (acao !== "perguntar") return { ok: false, erro: "Pedido inválido." };

  const texto = typeof pergunta === "string" ? pergunta.trim() : "";
  if (!texto) return { ok: false, erro: "Escreva a sua pergunta." };
  if (texto.length > TAMANHO_MAXIMO_DA_PERGUNTA) {
    return { ok: false, erro: `A pergunta pode ter até ${TAMANHO_MAXIMO_DA_PERGUNTA} caracteres.` };
  }
  return { ok: true, pedido: { acao, pergunta: texto, ...(conversa ? { conversaId: conversa } : {}) } };
}

/**
 * A pergunta que chega pelo endereço (/painel/assistente?pergunta=...). Ela só
 * preenche o campo: enviar continua sendo decisão de quem lê, porque gasta
 * franquia.
 */
export function perguntaDoLink(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpa = valor.trim().slice(0, TAMANHO_MAXIMO_DA_PERGUNTA).trim();
  return limpa || null;
}

export type FonteDaResposta = { url: string; titulo: string | null };

/** O que a tela recebe de uma conversa gravada: só texto visível, nunca o conteúdo bruto da API. */
export type MensagemDaTela = {
  id: string;
  papel: "usuario" | "assistente";
  texto: string;
  fontes: FonteDaResposta[];
  /** Na resposta: recado de recusa, corte ou interrupção, quando houve. */
  aviso?: string;
  /** Na resposta: ficou pela metade e dá para pedir o resto. */
  podeContinuar?: boolean;
};

export type ConversaDaLista = { id: string; titulo: string; atualizadaEm: string };

export type CotaDoAssistente = { usados: number; limite: number };

export type EventoAssistente =
  | { tipo: "inicio"; conversaId: string; titulo: string; nova: boolean }
  | { tipo: "status"; mensagem: string }
  | { tipo: "texto"; delta: string }
  | { tipo: "fonte"; url: string; titulo: string | null }
  /** A IA recusou: a resposta inteira desta pergunta some da tela e do histórico. */
  | { tipo: "recusa"; mensagem: string }
  | { tipo: "aviso"; mensagem: string }
  | { tipo: "erro"; codigo: string; mensagem: string; repetivel: boolean }
  /**
   * Fim do pedido. `salvo` diz se o texto desta volta ficou gravado (se não,
   * a tela tira o pedaço que mostrou). `continuar` pede mais uma volta.
   */
  | { tipo: "fim"; salvo: boolean; continuar: boolean; cota: CotaDoAssistente | null };

export function codificarEvento(evento: EventoAssistente) {
  return `${JSON.stringify(evento)}\n`;
}

const TIPOS = new Set(["inicio", "status", "texto", "fonte", "recusa", "aviso", "erro", "fim"]);

function interpretarLinha(linha: string): EventoAssistente | null {
  if (!linha.trim()) return null;
  try {
    const valor = JSON.parse(linha) as { tipo?: unknown };
    return typeof valor?.tipo === "string" && TIPOS.has(valor.tipo) ? (valor as EventoAssistente) : null;
  } catch {
    return null;
  }
}

/**
 * Separa os eventos de um fluxo que chega em pedaços quebrados em qualquer
 * ponto. Devolve os eventos completos e o resto (a linha ainda incompleta).
 */
export function separarEventos(acumulado: string): { eventos: EventoAssistente[]; resto: string } {
  const linhas = acumulado.split("\n");
  const resto = linhas.pop() ?? "";
  const eventos = linhas.map(interpretarLinha).filter((e): e is EventoAssistente => e !== null);
  return { eventos, resto };
}

/** Lê o corpo da resposta e chama `aoReceber` a cada evento, na ordem. */
export async function lerEventos(
  corpo: ReadableStream<Uint8Array>,
  aoReceber: (evento: EventoAssistente) => void,
) {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    const separado = separarEventos(resto + decodificador.decode(value, { stream: true }));
    resto = separado.resto;
    separado.eventos.forEach(aoReceber);
  }
  const ultimo = interpretarLinha(resto + decodificador.decode());
  if (ultimo) aoReceber(ultimo);
}
