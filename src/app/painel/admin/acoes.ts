"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { novaValidade, planoPorCodigo, DIAS_DE_CORTESIA } from "@/lib/assinatura";
import { ehContaDeExemplo } from "@/lib/demonstracao/conta";
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
  // O estúdio de exemplo não paga nem recebe plano: é só da demonstração.
  if (ehContaDeExemplo(pagamento.usuario)) return;

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
        plano: plano.codigo,
        validaAte,
      },
      /*
        O plano vigente passa a ser o último pago: é ele que libera as funções
        do Completo. Quem estava na demonstração passa a "ativa" aqui e, na
        próxima tela, vê os PRÓPRIOS dados (vazios no começo): o estúdio de
        exemplo nunca foi dele, então não há nada para misturar nem para limpar.
      */
      update: { status: "ativa", plano: plano.codigo, validaAte },
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
