"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { apenasDigitos, cpfValido, deDataLocal } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function validar(dados: FormData) {
  const nome = texto(dados, "nome");
  const telefone = texto(dados, "telefone");
  const email = texto(dados, "email");
  const cpf = texto(dados, "cpf");
  const endereco = texto(dados, "endereco");
  const nascimento = texto(dados, "nascimento");
  const observacoes = texto(dados, "observacoes");

  if (nome.length < 2) return { erro: "Escreva o nome da cliente, por favor." } as const;
  if (telefone.replace(/\D/g, "").length < 10) {
    return { erro: "O telefone precisa ter DDD e número, como (66) 99251-3501." } as const;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { erro: "Esse e-mail parece incompleto. Pode conferir?" } as const;
  }
  if (cpf && !cpfValido(cpf)) {
    return { erro: "Esse CPF não confere. Pode checar os números?" } as const;
  }

  const dataNascimento = nascimento ? deDataLocal(nascimento) : null;
  if (nascimento && !dataNascimento) {
    return { erro: "Não consegui entender a data de nascimento." } as const;
  }

  return {
    valores: {
      nome,
      telefone,
      email: email || null,
      cpf: cpf ? apenasDigitos(cpf) : null,
      endereco: endereco || null,
      nascimento: dataNascimento,
      observacoes: observacoes || null,
    },
  } as const;
}

export async function salvarCliente(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();
  const conferido = validar(dados);
  if ("erro" in conferido) return { erro: conferido.erro };

  const id = texto(dados, "id");

  if (id) {
    const existente = await prisma.cliente.findFirst({
      where: { id, usuarioId: usuario.id },
    });
    if (!existente) return { erro: "Não encontramos essa cliente na sua lista." };

    await prisma.cliente.update({ where: { id }, data: conferido.valores });
    revalidatePath("/painel/clientes");
    return { recado: `Prontinho, os dados de ${conferido.valores.nome} foram atualizados.` };
  }

  await prisma.cliente.create({
    data: { ...conferido.valores, usuarioId: usuario.id },
  });

  revalidatePath("/painel/clientes");
  revalidatePath("/painel");
  return { recado: `${conferido.valores.nome} entrou para a sua lista de clientes.` };
}

export async function excluirCliente(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");

  const cliente = await prisma.cliente.findFirst({ where: { id, usuarioId: usuario.id } });
  if (!cliente) return;

  await prisma.cliente.delete({ where: { id } });
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
}
