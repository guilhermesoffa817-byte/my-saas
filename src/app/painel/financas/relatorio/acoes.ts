"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritaDoRecurso } from "@/lib/guardas";
import { fecharMes, reabrirMes } from "@/lib/fechamento/operacoes";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel/financas");
  revalidatePath("/painel/financas/relatorio");
}

export async function fecharMesAcao(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("relatorio");
  const fechado = await fecharMes(prisma, usuario.id, texto(dados, "mes"), new Date());
  if ("erro" in fechado) return { erro: fechado.erro };

  atualizarTelas();
  return {
    recado:
      fechado.resultado === "ja_fechado"
        ? "Esse mês já estava fechado."
        : "Mês fechado. O resumo ficou guardado, e nada com data nele muda até você reabrir.",
  };
}

export async function reabrirMesAcao(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("relatorio");
  const reaberto = await reabrirMes(prisma, usuario.id, texto(dados, "mes"), new Date());
  if ("erro" in reaberto) return { erro: reaberto.erro };

  atualizarTelas();
  return {
    recado:
      reaberto.resultado === "nao_estava_fechado"
        ? "Esse mês já estava aberto."
        : "Mês reaberto. A reabertura ficou registrada; feche de novo quando terminar os ajustes.",
  };
}
