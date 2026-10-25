"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirEscritaDoRecurso } from "@/lib/guardas";
import { deDataLocal, lerPercentual, paraCentavos, paraDataLocal } from "@/lib/formato";
import { apagarLancamento, registrarLancamento } from "@/lib/financas-operacoes";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function salvarLancamento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("financas");

  const tipo = texto(dados, "tipo") === "entrada" ? "entrada" : "saida";
  const descricao = texto(dados, "descricao");
  const categoria = texto(dados, "categoria");
  // A mesma leitura do resto do Bossa: "1.500" é mil e quinhentos.
  const valor = paraCentavos(texto(dados, "valor"));
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

  // A trava do mês fechado mora dentro de registrarLancamento.
  const criado = await registrarLancamento(prisma, usuario.id, {
    tipo,
    descricao,
    categoria: categoria || null,
    valorCentavos: valor,
    data,
  });
  if ("erro" in criado) return { erro: criado.erro };

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
  const { usuario } = await exigirEscritaDoRecurso("financas");
  const id = texto(dados, "id");

  // Pagamento da Equipe sai pela Equipe, que apaga o pagamento e a saída juntos.
  const apagado = await apagarLancamento(prisma, usuario.id, id);
  // Formulário sem resposta na tela: o recado do mês fechado vai no endereço.
  if ("erro" in apagado) redirect("/painel/financas?aviso=mes-fechado");

  revalidatePath("/painel/financas");
  revalidatePath("/painel/financas/relatorio");
}

export async function salvarImposto(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("financas");
  // Até duas casas, como 4,5 ou 6,25: as alíquotas do Simples quase sempre têm.
  const percentual = lerPercentual(texto(dados, "percentual"));

  if (percentual === null) {
    return { erro: "Informe um percentual entre 0 e 100, com até duas casas, como 6 ou 4,5." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { impostoPercentual: percentual },
  });

  revalidatePath("/painel/financas");
  return { recado: "Percentual atualizado. O resumo já está usando o valor novo." };
}
