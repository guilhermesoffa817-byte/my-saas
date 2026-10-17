"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { embaralhar } from "@/lib/agendamento-online/embaralhar";
import { ipDoPedido } from "@/lib/ip";
import {
  agendarPeloLink,
  type RespostaDoAgendamento,
} from "@/lib/agendamento-online/operacoes";

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim().slice(0, 200) : "";
}

/** O IP de quem está marcando; a regra de qual cabeçalho vale mora em lib/ip.ts. */
async function ipDeQuemPede() {
  return ipDoPedido(await headers());
}

/**
 * A confirmação da página pública. Não tem sessão: quem decide de que estúdio
 * é o horário é o link, e toda a conferência (horário livre, limite de
 * tentativas, assinatura do estúdio) mora em lib/agendamento-online.
 */
export async function confirmarHorario(
  _anterior: RespostaDoAgendamento | null,
  dados: FormData,
): Promise<RespostaDoAgendamento> {
  const resposta = await agendarPeloLink(
    prisma,
    {
      link: texto(dados, "link"),
      servicoId: texto(dados, "servico"),
      quem: texto(dados, "quem"),
      dia: texto(dados, "dia"),
      hora: texto(dados, "hora"),
      nome: texto(dados, "nome"),
      telefone: texto(dados, "telefone"),
      isca: texto(dados, "site"),
    },
    {
      ipHash: embaralhar("ip", await ipDeQuemPede()),
      embaralharTelefone: (telefone) => embaralhar("telefone", telefone),
    },
  );

  if ("ok" in resposta) {
    // O horário novo já aparece no Início e na agenda da dona.
    revalidatePath("/painel");
    revalidatePath("/painel/agenda");
  }
  return resposta;
}
