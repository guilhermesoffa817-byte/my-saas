"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { gerarAcesso, revogarAcesso } from "@/lib/contador/operacoes";
import { ENDERECO_DO_SITE } from "@/lib/site";

export type RespostaDoLink = { erro?: string; recado?: string; link?: string } | null;

/**
 * Gera o link e devolve uma vez só. O banco guarda só o resumo do código, então
 * depois desta resposta nem o Bossa consegue mostrar o link de novo.
 */
export async function gerarLinkDoContador(): Promise<RespostaDoLink> {
  const { usuario } = await exigirRecurso("financas");
  const codigo = await gerarAcesso(prisma, usuario.id, new Date());
  revalidatePath("/painel/financas/contador");
  return {
    recado: "Link novo criado. O anterior, se havia, parou de funcionar.",
    link: `${ENDERECO_DO_SITE}/contador/${codigo}`,
  };
}

export async function revogarLinkDoContador(): Promise<RespostaDoLink> {
  const { usuario } = await exigirRecurso("financas");
  const revogado = await revogarAcesso(prisma, usuario.id, new Date());
  revalidatePath("/painel/financas/contador");
  return {
    recado: revogado
      ? "Link desligado. Quem tiver o endereço não consegue mais abrir."
      : "Não havia link ativo.",
  };
}
