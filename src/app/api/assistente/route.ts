import { codificarEvento, lerPedido, type EventoAssistente } from "@/lib/assistente/protocolo";
import { iaConfigurada } from "@/lib/ia/cliente";
import { atenderPedido } from "@/lib/ia/turno";
import { prisma } from "@/lib/prisma";
import { limiteDeIa } from "@/lib/recursos";
import { exigirEscritaNaApi } from "@/lib/guardas";

export const dynamic = "force-dynamic";
/**
 * Teto pedido à hospedagem. Cada pedido faz só UMA chamada à IA, então o
 * normal é terminar bem antes; no plano grátis da Netlify o corte pode vir em
 * cerca de 10 s, e aí a tela pede a volta de novo e o servidor retoma do que
 * ficou gravado.
 */
export const maxDuration = 120;
/** Prazo da chamada à IA dentro do pedido, abaixo do maxDuration: dá tempo de avisar a tela. */
const PRAZO_DA_VOLTA_MS = 110_000;

function recusar(status: number, mensagem: string, codigo: string) {
  return Response.json({ erro: mensagem, codigo }, { status });
}

/**
 * POST /api/assistente { acao: "perguntar", conversaId?, pergunta } ou
 * { acao: "continuar", conversaId } → eventos NDJSON. O histórico vem sempre do
 * banco, pela conversa do próprio estúdio; o navegador só manda a pergunta.
 */
export async function POST(request: Request) {
  /*
    Proteção contra pedido forjado por outro site: o cookie da sessão é
    SameSite=Lax (não vai em POST de outro site), e exigir JSON obriga o
    navegador a pedir licença antes (CORS), que esta rota nunca dá.
  */
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return recusar(415, "Pedido inválido.", "pedido");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return recusar(403, "Origem não permitida.", "origem");
  }

  // Porta de escrita: sempre a conta da sessão. Sem sessão, na demonstração,
  // com a assinatura vencida ou sem o Completo, responde com o `destino` que a
  // tela usa para levar a pessoa à assinatura, sem gastar nada da IA.
  const porta = await exigirEscritaNaApi("assistente");
  if (porta.resposta) return porta.resposta;
  const { usuario } = porta;
  if (!iaConfigurada()) {
    return recusar(503, "O assistente ainda não foi ativado neste servidor.", "config");
  }
  if (!usuario.iaAceitaEm) {
    return recusar(403, "Leia e aceite o aviso do assistente antes da primeira pergunta.", "consentimento");
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return recusar(400, "Pedido inválido.", "pedido");
  }
  const lido = lerPedido(corpo);
  if (!lido.ok) return recusar(400, lido.erro, "pedido");

  const sinal = AbortSignal.any([request.signal, AbortSignal.timeout(PRAZO_DA_VOLTA_MS)]);
  const codificador = new TextEncoder();

  const fluxo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitir = (evento: EventoAssistente) => {
        try {
          controller.enqueue(codificador.encode(codificarEvento(evento)));
        } catch {
          // O navegador já fechou a conexão.
        }
      };
      await atenderPedido({
        db: prisma,
        estudio: { id: usuario.id, ramo: usuario.ramo, pixCidade: usuario.pixCidade },
        pedido: lido.pedido,
        limite: limiteDeIa(usuario, "assistente"),
        emitir,
        signal: sinal,
      });
      try {
        controller.close();
      } catch {
        // Já fechado.
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
