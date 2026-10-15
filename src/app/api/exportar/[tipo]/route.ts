import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/guardas";
import { nomeDoArquivo } from "@/lib/csv";
import { planilhaEmCsv, tipoDePlanilhaValido } from "../planilhas";

export const dynamic = "force-dynamic";

/**
 * Baixa uma planilha com os dados do estúdio da sessão.
 *
 * Pede só a sessão, e não a assinatura em dia: quem deixou de pagar continua
 * dona dos próprios dados e precisa conseguir levá-los embora. Quem não entrou
 * vai para a tela de entrada, como em qualquer tela do painel.
 */
export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const usuario = await exigirUsuario();
  const { tipo } = await params;

  if (!tipoDePlanilhaValido(tipo)) {
    return new Response("Essa planilha não existe.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const agora = new Date();
  const csv = await planilhaEmCsv(prisma, usuario.id, tipo, agora);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(tipo, agora)}"`,
      // Dado pessoal de cliente: nenhum cache no caminho guarda uma cópia.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
