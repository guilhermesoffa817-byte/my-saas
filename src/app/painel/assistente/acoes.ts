"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirContaPropria, exigirEscritaDoRecurso } from "@/lib/guardas";
import { idValido } from "@/lib/assistente/protocolo";
import { aceitarAvisoDaIa, apagarConversa as apagarDoBanco } from "@/lib/ia/conversas";

export type Resposta = { erro?: string; recado?: string; apagada?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Primeiro uso: a dona leu como o assistente usa os dados (Anthropic, totais, fora do Brasil) e aceitou. */
export async function aceitarAviso(): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("assistente");
  await aceitarAvisoDaIa(prisma, usuario.id);
  revalidatePath("/painel/assistente");
  return { recado: "Pronto. O assistente está liberado." };
}

/**
 * Apagar a própria conversa vale mesmo com o plano vencido: o dado é da dona
 * (LGPD, art. 18). Por isso aqui basta estar logada.
 */
export async function apagarConversa(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirContaPropria();
  const id = texto(dados, "id");
  if (!idValido(id)) return { erro: "Não encontramos essa conversa." };

  // O id veio do navegador: só apaga se a conversa for deste estúdio.
  const apagou = await apagarDoBanco(prisma, usuario.id, id);
  if (!apagou) return { erro: "Não encontramos essa conversa." };

  revalidatePath("/painel/assistente");
  return { recado: "Conversa apagada.", apagada: id };
}

const TAMANHO_DO_RAMO = 60;

/**
 * O ramo do negócio, que o assistente usa nas pesquisas de tendência. Vale para
 * as conversas novas: as antigas guardam o que usaram quando começaram.
 */
export async function salvarRamo(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("assistente");
  const ramo = texto(dados, "ramo").replace(/\s+/g, " ");
  if (ramo.length > TAMANHO_DO_RAMO) {
    return { erro: `Escreva o ramo em até ${TAMANHO_DO_RAMO} letras, como "salão de beleza".` };
  }
  await prisma.usuario.update({ where: { id: usuario.id }, data: { ramo: ramo || null } });
  revalidatePath("/painel/assistente");
  return { recado: ramo ? "Ramo salvo. Vale para as próximas conversas." : "Ramo apagado." };
}
