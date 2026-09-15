"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/guardas";
import { PLANO } from "@/lib/assinatura";
import { competenciaAtual } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

export async function avisarPagamento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const usuario = await exigirUsuario();

  const observacao = (() => {
    const valor = dados.get("observacao");
    return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, 300) : null;
  })();

  const jaAvisado = await prisma.pagamento.findFirst({
    where: { usuarioId: usuario.id, status: "aguardando" },
  });

  if (jaAvisado) {
    return {
      recado:
        "Seu aviso já está com a gente e estamos conferindo. Pode deixar que assim que cair, liberamos tudo.",
    };
  }

  await prisma.pagamento.create({
    data: {
      usuarioId: usuario.id,
      valorCentavos: PLANO.valorCentavos,
      competencia: competenciaAtual(),
      observacao,
    },
  });

  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
  revalidatePath("/painel/admin");

  return {
    recado:
      "Obrigado por avisar! Vamos conferir o Pix e liberar mais 30 dias para você. Se demorar, é só chamar a gente.",
  };
}
