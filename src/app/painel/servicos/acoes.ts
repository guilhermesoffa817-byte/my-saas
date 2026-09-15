"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { paraCentavos } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function salvarServico(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const nome = texto(dados, "nome");
  const preco = paraCentavos(texto(dados, "preco"));
  const duracao = Number(texto(dados, "duracaoMin"));
  const descricao = texto(dados, "descricao");
  const id = texto(dados, "id");

  if (nome.length < 2) return { erro: "Dê um nome para o serviço, por favor." };
  if (preco === null) return { erro: "Escreva o preço usando números, como 180 ou 180,50." };
  if (!Number.isFinite(duracao) || duracao < 5 || duracao > 600) {
    return { erro: "A duração precisa ficar entre 5 e 600 minutos." };
  }

  const valores = {
    nome,
    precoCentavos: preco,
    duracaoMin: Math.round(duracao),
    descricao: descricao || null,
  };

  if (id) {
    const existente = await prisma.servico.findFirst({ where: { id, usuarioId: usuario.id } });
    if (!existente) return { erro: "Não encontramos esse serviço na sua lista." };

    await prisma.servico.update({ where: { id }, data: valores });
    revalidatePath("/painel/servicos");
    revalidatePath("/painel/agenda");
    return { recado: `${nome} foi atualizado.` };
  }

  await prisma.servico.create({ data: { ...valores, usuarioId: usuario.id } });
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
  return { recado: `${nome} já está disponível na hora de agendar.` };
}

export async function alternarServico(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = typeof dados.get("id") === "string" ? String(dados.get("id")) : "";

  const servico = await prisma.servico.findFirst({ where: { id, usuarioId: usuario.id } });
  if (!servico) return;

  await prisma.servico.update({ where: { id }, data: { ativo: !servico.ativo } });
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
}

/** Apaga o serviço; se ele já tiver histórico, apenas o guarda como inativo. */
export async function removerServico(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = typeof dados.get("id") === "string" ? String(dados.get("id")) : "";

  const servico = await prisma.servico.findFirst({
    where: { id, usuarioId: usuario.id },
    include: { _count: { select: { agendamentos: true } } },
  });
  if (!servico) return;

  if (servico._count.agendamentos > 0) {
    await prisma.servico.update({ where: { id }, data: { ativo: false } });
  } else {
    await prisma.servico.delete({ where: { id } });
  }

  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
}
