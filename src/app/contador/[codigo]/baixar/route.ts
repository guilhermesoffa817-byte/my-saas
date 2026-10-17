import { prisma } from "@/lib/prisma";
import { mesDoPedido, relatorioDoMes } from "@/lib/relatorio/operacoes";
import { ehFormato, respostaComArquivo } from "@/lib/relatorio/arquivo";
import { abrirComCodigo } from "../abrir";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * O download do contador: o mesmo arquivo da dona, do mesmo relatório. O
 * código passa pela mesma conferência da página, com o mesmo limite por IP.
 */
export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const abertura = await abrirComCodigo(codigo);
  if (abertura.situacao === "bloqueado") {
    return new Response("Muitas tentativas. Tente de novo mais tarde.", { status: 429, headers: SEM_CACHE });
  }
  if (abertura.situacao !== "aberto") {
    return new Response("Link não disponível.", { status: 404, headers: SEM_CACHE });
  }

  const agora = new Date();
  const busca = new URL(pedido.url).searchParams;
  const formato = busca.get("formato");
  if (!ehFormato(formato)) {
    return new Response("Formato desconhecido. Use csv ou xlsx.", { status: 400, headers: SEM_CACHE });
  }

  const mes = mesDoPedido(busca.get("mes"), agora);
  const { relatorio, fechamento } = await relatorioDoMes(prisma, abertura.usuarioId, mes, agora);
  return respostaComArquivo({
    relatorio,
    nomeNegocio: abertura.nomeNegocio,
    fechamento,
    formato,
    agora,
  });
}
