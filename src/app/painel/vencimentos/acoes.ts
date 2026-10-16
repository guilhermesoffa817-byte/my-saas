"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import {
  deDataPura,
  hojeNoEstudio,
  paraCentavos,
  paraDataPura,
} from "@/lib/formato";
import { ocorrenciasQueFaltam } from "@/lib/vencimento";
import { apagarVencimento, pagarVencimento } from "@/lib/vencimento-operacoes";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel");
  revalidatePath("/painel/vencimentos");
  revalidatePath("/painel/financas");
}

const TIPOS = ["conta", "prazo"] as const;

export async function salvarVencimento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirRecurso("vencimentos");

  const tipo = TIPOS.includes(texto(dados, "tipo") as (typeof TIPOS)[number])
    ? texto(dados, "tipo")
    : "conta";
  const descricao = texto(dados, "descricao");
  const categoria = texto(dados, "categoria");
  const valorTexto = texto(dados, "valor");
  const valorCentavos = valorTexto ? paraCentavos(valorTexto) : null;
  const data = deDataPura(texto(dados, "data"));
  const repete = dados.get("repete") === "on";
  const ate = texto(dados, "ate") ? deDataPura(texto(dados, "ate")) : null;

  if (descricao.length < 2) {
    return { erro: "Escreva o que é, para você reconhecer depois." };
  }
  if (valorTexto && (!valorCentavos || valorCentavos <= 0)) {
    return { erro: "Informe um valor maior que zero, como 800,00." };
  }
  if (tipo === "conta" && !valorCentavos) {
    return { erro: "Conta a pagar precisa de valor." };
  }
  if (!data) {
    return { erro: "Não consegui entender a data. Pode conferir, por favor?" };
  }
  if (texto(dados, "ate") && !ate) {
    return { erro: "Não consegui entender a data final. Pode conferir?" };
  }
  if (ate && ate.getTime() < data.getTime()) {
    return { erro: "A data final não pode ser antes da primeira." };
  }

  if (!repete) {
    await prisma.vencimento.create({
      data: {
        usuarioId: usuario.id,
        tipo,
        descricao,
        categoria: categoria || null,
        valorCentavos,
        data,
      },
    });
    atualizarTelas();
    return { recado: "Vencimento guardado." };
  }

  const repeticao = await prisma.repeticaoDeVencimento.create({
    data: {
      usuarioId: usuario.id,
      tipo,
      descricao,
      categoria: categoria || null,
      valorCentavos,
      primeira: data,
      ate,
    },
    select: { id: true },
  });

  await completarRepeticao(repeticao.id, usuario.id);

  atualizarTelas();
  return {
    recado: ate
      ? "Combinado guardado. As datas foram geradas até o fim dele."
      : "Combinado guardado. O Bossa mantém sempre os próximos doze meses.",
  };
}

/**
 * Completa as ocorrências que faltam de uma repetição.
 *
 * É chamada quando a tela abre e quando o combinado é criado. Não existe tarefa
 * agendada: a cada visita o Bossa compara o que deveria existir com o que
 * existe e grava a diferença. O par repetição e data é único no banco, então
 * duas visitas ao mesmo tempo não criam a mesma data duas vezes.
 */
export async function completarRepeticao(repeticaoId: string, usuarioId: string) {
  const repeticao = await prisma.repeticaoDeVencimento.findFirst({
    where: { id: repeticaoId, usuarioId, ativa: true },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      categoria: true,
      valorCentavos: true,
      primeira: true,
      ate: true,
      vencimentos: { select: { data: true } },
    },
  });
  if (!repeticao) return;

  const faltam = ocorrenciasQueFaltam({
    primeira: repeticao.primeira,
    ate: repeticao.ate,
    jaGravadas: repeticao.vencimentos.map((item) => item.data),
    hoje: hojeNoEstudio(),
  });
  if (faltam.length === 0) return;

  await prisma.vencimento.createMany({
    data: faltam.map((data) => ({
      usuarioId,
      repeticaoId: repeticao.id,
      tipo: repeticao.tipo,
      descricao: repeticao.descricao,
      categoria: repeticao.categoria,
      valorCentavos: repeticao.valorCentavos,
      data,
    })),
    skipDuplicates: true,
  });
}

export async function marcarComoPago(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirRecurso("vencimentos");

  const id = texto(dados, "id");
  const pagoEm = deDataPura(texto(dados, "pagoEm") || paraDataPura(hojeNoEstudio()));
  if (!pagoEm) return { erro: "Não consegui entender a data do pagamento." };

  const pago = await pagarVencimento(prisma, usuario.id, id, pagoEm);
  if ("erro" in pago) return { erro: pago.erro };
  if (pago.resultado === "ja_pago") return { recado: "Esse já estava marcado como pago." };

  atualizarTelas();
  return {
    recado:
      pago.tipo === "conta"
        ? "Pago. A saída já entrou nas suas finanças."
        : "Marcado como resolvido.",
  };
}

export async function excluirVencimento(dados: FormData) {
  const { usuario } = await exigirRecurso("vencimentos");
  const id = texto(dados, "id");

  // O lançamento do pagamento sai junto, se o mês dele não estiver fechado.
  const apagado = await apagarVencimento(prisma, usuario.id, id);
  if ("erro" in apagado) redirect("/painel/vencimentos?aviso=mes-fechado");

  atualizarTelas();
}

export async function encerrarRepeticao(dados: FormData) {
  const { usuario } = await exigirRecurso("vencimentos");
  const id = texto(dados, "id");

  await prisma.$transaction(async (tx) => {
    const mudadas = await tx.repeticaoDeVencimento.updateMany({
      where: { id, usuarioId: usuario.id, ativa: true },
      data: { ativa: false },
    });
    if (mudadas.count === 0) return;

    // As datas futuras que ninguém pagou somem; o que já foi pago fica no
    // histórico, porque aquilo aconteceu de verdade.
    await tx.vencimento.deleteMany({
      where: {
        repeticaoId: id,
        usuarioId: usuario.id,
        pago: false,
        data: { gt: hojeNoEstudio() },
      },
    });
  });

  atualizarTelas();
}
