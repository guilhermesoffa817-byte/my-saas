import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { abrirVisita } from "@/lib/demonstracao/visita";

/**
 * "Ver o sistema por dentro", da página de vendas: abre o estúdio de exemplo
 * sem pedir cadastro. Quem já tem conta vai direto para o painel dela.
 */
export async function GET() {
  if (!(await usuarioAtual())) await abrirVisita();
  redirect("/painel");
}
