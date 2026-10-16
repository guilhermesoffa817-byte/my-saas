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
import {
  apagarVencimento,
  completarRepeticao,
  criarVencimento,
  encerrarRepeticao as encerrarDoBanco,
  pagarVencimento,
} from "@/lib/vencimento-operacoes";

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
    const criado = await criarVencimento(prisma, usuario.id, {
      tipo,
      descricao,
      categoria: categoria || null,
      valorCentavos,
      data,
    });
    if ("erro" in criado) return { erro: criado.erro };
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

  await completarRepeticao(prisma, usuario.id, repeticao.id, hojeNoEstudio());

  atualizarTelas();
  return {
    recado: ate
      ? "Combinado guardado. As datas foram geradas até o fim dele."
      : "Combinado guardado. O Bossa mantém sempre os próximos doze meses.",
  };
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

  // Conta de mês fechado fica; o lançamento do pagamento sai junto, se o mês dele estiver aberto.
  const apagado = await apagarVencimento(prisma, usuario.id, id);
  if ("erro" in apagado) redirect("/painel/vencimentos?aviso=mes-fechado");

  atualizarTelas();
}

export async function encerrarRepeticao(dados: FormData) {
  const { usuario } = await exigirRecurso("vencimentos");
  const id = texto(dados, "id");

  // As datas futuras que ninguém pagou somem, menos as de um mês já fechado.
  await encerrarDoBanco(prisma, usuario.id, id, hojeNoEstudio());

  atualizarTelas();
}
