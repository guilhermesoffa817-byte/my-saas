import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { abrirVisita } from "@/lib/demonstracao/visita";
import { PARAMETRO_DO_EVENTO } from "@/lib/medicao";

/**
 * "Ver o sistema por dentro", da página de vendas: abre o estúdio de exemplo
 * sem pedir cadastro. Quem já tem conta vai direto para o painel dela.
 */
export async function GET() {
  if (await usuarioAtual()) redirect("/painel");
  await abrirVisita();
  // Avisa a medição dos anúncios (src/lib/medicao.ts) que a demonstração abriu.
  redirect(`/painel?${PARAMETRO_DO_EVENTO}=demonstracao`);
}
