"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/guardas";
import { planoPorCodigo } from "@/lib/assinatura";
import { avisarPix } from "@/lib/assinatura-operacoes";
import { emReais } from "@/lib/formato";

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

  /*
    Só existe um aviso esperando por conta. Avisar de novo, de outra aba ou com
    outro plano, atualiza esse aviso (plano, valor e recado) em vez de criar
    outro: o admin vê sempre o que a pessoa escolheu por último.
  */
  const aviso = await avisarPix(prisma, {
    usuarioId: usuario.id,
    plano: dados.get("plano"),
    observacao,
  });
  const plano = planoPorCodigo(aviso.plano);

  revalidatePath("/painel/assinatura");
  revalidatePath("/painel");
  revalidatePath("/painel/admin");

  if (aviso.tipo === "trocado") {
    return {
      recado: `Atualizamos o seu aviso para ${plano.nome} (${emReais(plano.valorCentavos)}). Vamos conferir o Pix com esse valor.`,
    };
  }
  if (aviso.tipo === "mesmo") {
    return {
      recado: `Seu aviso do ${plano.nome} já está conosco e estamos conferindo.${observacao ? " Guardamos o seu recado." : ""} Assim que o pagamento cair, liberamos o acesso.`,
    };
  }
  return {
    recado: `Obrigado por avisar! Vamos conferir o Pix de ${emReais(plano.valorCentavos)} (${plano.nome}) e liberar o seu acesso.`,
  };
}
