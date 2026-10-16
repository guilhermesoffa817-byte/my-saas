"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import {
  ligarAgendaOnline,
  lerConfiguracao,
  marcarNovosComoVistos,
  salvarConfiguracao,
} from "@/lib/agendamento-online/operacoes";

export type Resposta = { erro?: string; recado?: string } | null;

function atualizarTelas() {
  revalidatePath("/painel/agendamento-online");
  revalidatePath("/painel/servicos");
}

/** O agendamento online é dos dois planos: basta a assinatura estar em dia. */
export async function salvarAgendaOnline(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const entrada = lerConfiguracao(dados);
  if ("erro" in entrada) return { erro: entrada.erro };

  const salvo = await salvarConfiguracao(prisma, usuario.id, entrada);
  if ("erro" in salvo) return { erro: salvo.erro };

  atualizarTelas();
  return { recado: "Configuração salva. A página já usa os horários novos." };
}

export async function ligarOuDesligar(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();
  const ligar = dados.get("ligar") === "sim";

  const resultado = await ligarAgendaOnline(prisma, usuario.id, ligar);
  if ("erro" in resultado) return { erro: resultado.erro };

  atualizarTelas();
  return {
    recado: ligar
      ? "Página no ar. Já pode mandar o link para os seus clientes."
      : "Página desligada. Quem abrir o link vai ver que ela não está disponível.",
  };
}

/** "Já vi" do Início: tira o destaque dos horários que chegaram pelo link. */
export async function marcarNovosVistos() {
  const { usuario } = await exigirAcesso();
  await marcarNovosComoVistos(prisma, usuario.id);
  revalidatePath("/painel");
}
