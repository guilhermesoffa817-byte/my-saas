"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { novaValidade, planoPorCodigo, DIAS_DE_TESTE } from "@/lib/assinatura";
import { somarDias } from "@/lib/formato";

function idDo(dados: FormData) {
  const valor = dados.get("id");
  return typeof valor === "string" ? valor : "";
}

export async function confirmarPagamento(dados: FormData) {
  await exigirAdmin();
  const id = idDo(dados);

  const pagamento = await prisma.pagamento.findUnique({
    where: { id },
    include: { usuario: { include: { assinatura: true } } },
  });
  if (!pagamento || pagamento.status !== "aguardando") return;

  const agora = new Date();
  // Quem pagou o anual ganha 365 dias, não os 30 do mensal.
  const plano = planoPorCodigo(pagamento.plano);
  const validaAte = novaValidade(
    pagamento.usuario.assinatura?.validaAte ?? null,
    agora,
    plano.dias,
  );

  await prisma.$transaction([
    prisma.pagamento.update({
      where: { id },
      data: { status: "confirmado", respondidoEm: agora },
    }),
    prisma.assinatura.upsert({
      where: { usuarioId: pagamento.usuarioId },
      create: {
        usuarioId: pagamento.usuarioId,
        status: "ativa",
        validaAte,
      },
      update: { status: "ativa", validaAte },
    }),
  ]);

  revalidatePath("/painel/admin");
  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
}

export async function recusarPagamento(dados: FormData) {
  await exigirAdmin();
  const id = idDo(dados);

  const pagamento = await prisma.pagamento.findUnique({ where: { id } });
  if (!pagamento || pagamento.status !== "aguardando") return;

  await prisma.pagamento.update({
    where: { id },
    data: { status: "recusado", respondidoEm: new Date() },
  });

  revalidatePath("/painel/admin");
  revalidatePath("/painel/assinatura");
}

/** Estende o acesso de uma assinante por alguns dias, como cortesia. */
export async function darCortesia(dados: FormData) {
  await exigirAdmin();
  const usuarioId = typeof dados.get("usuarioId") === "string" ? String(dados.get("usuarioId")) : "";

  const assinatura = await prisma.assinatura.findUnique({ where: { usuarioId } });
  if (!assinatura) return;

  const base =
    assinatura.validaAte.getTime() > Date.now() ? assinatura.validaAte : new Date();

  await prisma.assinatura.update({
    where: { usuarioId },
    data: { validaAte: somarDias(base, DIAS_DE_TESTE) },
  });

  revalidatePath("/painel/admin");
  revalidatePath("/painel");
}
