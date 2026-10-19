"use server";

import { headers } from "next/headers";
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

  /*
    Nada de revalidatePath aqui. No Next 16, qualquer revalidação (ou cookie
    gravado) dentro de uma ação faz a resposta trazer esta página montada de
    novo; montada de novo, ela já vê o horário ocupado, tira o formulário da
    tela e a cliente lê "Esse horário não está mais livre" em vez da
    confirmação. As telas da dona (Início e agenda) são dinâmicas e leem o
    banco a cada visita, então o horário novo aparece lá sem revalidar nada.
    O teste src/testes/agendar-pelo-link-banco.teste.ts segura isso.
  */
  return resposta;
}
