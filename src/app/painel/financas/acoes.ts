"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirFinanceiro } from "@/lib/guardas";
import {
  competenciaAtual,
  deDataLocal,
  inicioDoProximoMes,
  paraDataLocal,
} from "@/lib/formato";
import { lerPercentual, lerValor, nomeDoMes } from "@/lib/financas";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function salvarLancamento(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirFinanceiro();
  const agora = new Date();

  const tipo = texto(dados, "tipo") === "entrada" ? "entrada" : "saida";
  const descricao = texto(dados, "descricao");
  const categoria = texto(dados, "categoria");
  const valor = lerValor(texto(dados, "valor"));
  const data = deDataLocal(texto(dados, "data") || paraDataLocal(agora));

  if (descricao.length < 2) {
    return { erro: "Escreva uma descrição para você reconhecer o lançamento depois." };
  }
  if (descricao.length > 120) {
    return { erro: "A descrição ficou longa demais. Pode resumir em até 120 letras?" };
  }
  if (categoria.length > 40) {
    return { erro: "A categoria ficou longa demais. Uma ou duas palavras bastam." };
  }
  if (!valor) {
    return {
      erro: "Informe um valor maior que zero e até R$ 1.000.000,00, como 150,00.",
    };
  }
  if (!data || data.getFullYear() < 2000) {
    return { erro: "Não consegui entender a data. Pode conferir, por favor?" };
  }
  // Lançamento é dinheiro que já entrou ou saiu neste mês ou antes. Conta de
  // mês que vem ficaria escondida até lá: o lugar dela é em Vencimentos.
  if (data.getTime() >= inicioDoProximoMes(agora).getTime()) {
    return {
      erro: "Essa data ainda não chegou. Para conta que vai vencer, use Vencimentos; aqui entra o que já aconteceu.",
    };
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

  // Diz em que mês o lançamento entrou: quem está olhando um mês passado
  // precisa saber que ele foi parar em outro.
  const mes = competenciaAtual(data);
  const mesDeHoje = competenciaAtual(agora);
  const onde =
    mes === mesDeHoje
      ? "no resumo deste mês"
      : `no resumo de ${nomeDoMes(mes, Number(mesDeHoje.slice(0, 4)))}`;

  return {
    recado:
      tipo === "entrada"
        ? `Entrada registrada. Ela já aparece ${onde}.`
        : `Despesa registrada. Ela já aparece ${onde}.`,
  };
}

export async function excluirLancamento(dados: FormData) {
  const { usuario } = await exigirFinanceiro();
  const id = texto(dados, "id");
  if (!id) return;

  // O estúdio vai no mesmo filtro da exclusão: o id de outro estúdio não apaga nada.
  await prisma.lancamento.deleteMany({ where: { id, usuarioId: usuario.id } });
  revalidatePath("/painel/financas");
  revalidatePath("/painel");
}

export async function salvarImposto(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirFinanceiro();
  const percentual = lerPercentual(texto(dados, "percentual"));

  if (percentual === null) {
    return { erro: "Informe um percentual entre 0 e 100, como 6." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { impostoPercentual: percentual },
  });

  revalidatePath("/painel/financas");
  return {
    recado: `Percentual guardado: ${percentual}%. O resumo já está usando o valor novo.`,
  };
}
