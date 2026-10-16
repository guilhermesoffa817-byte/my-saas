import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { mesDoPedido, relatorioDoMes } from "@/lib/relatorio/operacoes";
import { ehFormato, respostaComArquivo } from "@/lib/relatorio/arquivo";

export const dynamic = "force-dynamic";

/**
 * O relatório do mês em CSV ou Excel, para a dona baixar ou mandar ao
 * contador. Mês fechado sai do resumo congelado, igual à tela.
 */
export async function GET(pedido: Request) {
  const { usuario } = await exigirRecurso("financas");
  const agora = new Date();
  const busca = new URL(pedido.url).searchParams;
  const formato = busca.get("formato");
  if (!ehFormato(formato)) {
    return new Response("Formato desconhecido. Use csv ou xlsx.", { status: 400 });
  }

  const mes = mesDoPedido(busca.get("mes"), agora);
  const { relatorio, fechamento } = await relatorioDoMes(prisma, usuario.id, mes, agora);
  return respostaComArquivo({
    relatorio,
    nomeNegocio: usuario.nomeNegocio,
    fechamento,
    formato,
    agora,
  });
}
