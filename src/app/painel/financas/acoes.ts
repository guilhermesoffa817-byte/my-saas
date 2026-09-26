"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirFinanceiro } from "@/lib/guardas";
import { deDataLocal, paraDataLocal } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Aceita "1.234,56" e "1234.56"; guarda sempre em centavos. */
function emCentavos(valor: string) {
  const limpo = valor.replace(/\s|R\$/g, "");
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 100);
}

export async function salvarLancamento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirFinanceiro();

  const tipo = texto(dados, "tipo") === "entrada" ? "entrada" : "saida";
  const descricao = texto(dados, "descricao");
  const categoria = texto(dados, "categoria");
  const valor = emCentavos(texto(dados, "valor"));
  const data = deDataLocal(texto(dados, "data") || paraDataLocal(new Date()));

  if (descricao.length < 2) {
    return { erro: "Escreva uma descrição para você reconhecer o lançamento depois." };
  }
  if (!valor) {
    return { erro: "Informe um valor maior que zero, como 150,00." };
  }
  if (!data) {
    return { erro: "Não consegui entender a data. Pode conferir, por favor?" };
  }

  await prisma.lancamento.create({
    data: {
      usuarioId: usuario.id,
      tipo,
      descricao,
      categoria: categoria || null,
      valorCentavos: valor,
      data,
    },
  });

  revalidatePath("/painel/financas");
  revalidatePath("/painel");

  return {
    recado:
      tipo === "entrada"
        ? "Entrada registrada. Ela já aparece no resumo do mês."
        : "Despesa registrada. Ela já aparece no resumo do mês.",
  };
}

export async function excluirLancamento(dados: FormData) {
  const { usuario } = await exigirFinanceiro();
  const id = texto(dados, "id");

  const lancamento = await prisma.lancamento.findFirst({
    where: { id, usuarioId: usuario.id },
  });
  if (!lancamento) return;

  await prisma.lancamento.delete({ where: { id } });
  revalidatePath("/painel/financas");
}

export async function salvarImposto(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirFinanceiro();
  const percentual = Number(texto(dados, "percentual").replace(",", "."));

  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    return { erro: "Informe um percentual entre 0 e 100." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { impostoPercentual: Math.round(percentual) },
  });

  revalidatePath("/painel/financas");
  return { recado: "Percentual atualizado. O resumo já está usando o valor novo." };
}
