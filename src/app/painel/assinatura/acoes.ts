"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/guardas";
import { PLANOS, codigoDoPlano } from "@/lib/assinatura";
import { competenciaAtual } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

export async function avisarPagamento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const usuario = await exigirUsuario();

  // Sem um plano reconhecido, nada é registrado. Cair no mensal por conta
  // própria liberaria o plano errado quando o Pix fosse confirmado.
  const codigo = codigoDoPlano(dados.get("plano"));
  if (!codigo) {
    return { erro: "Escolha um dos planos acima antes de avisar o Pix." };
  }
  const plano = PLANOS[codigo];

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
        "Seu aviso já está conosco e estamos conferindo. Assim que o pagamento cair, liberamos o acesso.",
    };
  }

  await prisma.pagamento.create({
    data: {
      usuarioId: usuario.id,
      valorCentavos: plano.valorCentavos,
      plano: plano.codigo,
      competencia: competenciaAtual(),
      observacao,
    },
  });

  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
  revalidatePath("/painel/admin");

  return {
    recado:
      `Obrigado por avisar! Vamos conferir o Pix e liberar mais ${plano.dias} dias para você. Se demorar, é só nos chamar.`,
  };
}
