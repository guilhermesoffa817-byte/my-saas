"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { DIAS_DE_CORTESIA } from "@/lib/assinatura";
import { confirmarPix, recusarPix } from "@/lib/assinatura-operacoes";
import { ehContaDeExemplo } from "@/lib/demonstracao/conta";
import { somarDias } from "@/lib/formato";

function idDo(dados: FormData) {
  const valor = dados.get("id");
  return typeof valor === "string" ? valor : "";
}

export async function confirmarPagamento(dados: FormData) {
  await exigirAdmin();
  // A regra de troca de plano (mesma família soma dias; família diferente
  // converte o saldo em dias do plano novo) mora em lib/assinatura.ts.
  const plano = dados.get("plano");
  const valorCentavos = Number(dados.get("valorCentavos"));
  if (typeof plano !== "string" || !Number.isInteger(valorCentavos)) return;
  await confirmarPix(prisma, idDo(dados), new Date(), { plano, valorCentavos });

  revalidatePath("/painel/admin");
  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
}

export async function recusarPagamento(dados: FormData) {
  await exigirAdmin();
  await recusarPix(prisma, idDo(dados));

  revalidatePath("/painel/admin");
  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
}

/** Estende o acesso de uma assinante por alguns dias, como cortesia. */
export async function darCortesia(dados: FormData) {
  await exigirAdmin();
  const usuarioId = typeof dados.get("usuarioId") === "string" ? String(dados.get("usuarioId")) : "";

  const assinatura = await prisma.assinatura.findUnique({
    where: { usuarioId },
    include: { usuario: { select: { id: true, papel: true } } },
  });
  if (!assinatura || ehContaDeExemplo(assinatura.usuario)) return;

  const base =
    assinatura.validaAte.getTime() > Date.now() ? assinatura.validaAte : new Date();

  await prisma.assinatura.update({
    where: { usuarioId },
    // Quem estava na demonstração vira teste de cortesia: usa com os próprios dados.
    data: {
      validaAte: somarDias(base, DIAS_DE_CORTESIA),
      ...(assinatura.status === "demonstracao" ? { status: "teste" } : {}),
    },
  });

  revalidatePath("/painel/admin");
  revalidatePath("/painel");
}
