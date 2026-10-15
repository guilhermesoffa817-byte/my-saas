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

/*
  Limites folgados para qualquer cardápio de verdade. Existem para que um envio
  forjado não grave um texto enorme, nem um preço que estoure a coluna do banco
  e quebre a soma do faturamento.
*/
const LIMITES = {
  nome: 80,
  descricao: 300,
  /** Cem mil reais, o mesmo teto de uma cobrança. */
  precoCentavos: 10_000_000,
};

function atualizarTelas() {
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
}

export async function salvarServico(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const nome = texto(dados, "nome");
  const preco = paraCentavos(texto(dados, "preco"));
  const duracao = Number(texto(dados, "duracaoMin"));
  const descricao = texto(dados, "descricao");
  const id = texto(dados, "id");

  if (nome.length < 2) return { erro: "Dê um nome para o serviço, por favor." };
  if (nome.length > LIMITES.nome) {
    return { erro: "Esse nome ficou comprido demais. Pode encurtar?" };
  }
  if (preco === null) return { erro: "Escreva o preço usando números, como 180 ou 180,50." };
  if (preco > LIMITES.precoCentavos) {
    return { erro: "Esse preço ficou alto demais. Pode conferir?" };
  }
  if (descricao.length > LIMITES.descricao) {
    return { erro: "A descrição passou de 300 letras. Pode resumir um pouco?" };
  }
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
    atualizarTelas();
    return { recado: `${nome} foi atualizado.` };
  }

  await prisma.servico.create({ data: { ...valores, usuarioId: usuario.id } });
  atualizarTelas();
  return { recado: `${nome} já está disponível na hora de agendar.` };
}

export async function alternarServico(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");
  if (!id) return;

  const servico = await prisma.servico.findFirst({
    where: { id, usuarioId: usuario.id },
    select: { ativo: true },
  });
  if (!servico) return;

  // A condição leva o estado lido: no toque duplo, o segundo envio não acha
  // mais o serviço do jeito que estava e não desfaz o primeiro.
  await prisma.servico.updateMany({
    where: { id, usuarioId: usuario.id, ativo: servico.ativo },
    data: { ativo: !servico.ativo },
  });
  atualizarTelas();
}

/**
 * Apaga o serviço que ainda não tem atendimento nenhum. O que já tem histórico
 * só sai do cardápio: os horários antigos apontam para ele, e o faturamento
 * dos meses passados depende disso.
 *
 * A condição de "sem atendimento" vai dentro do próprio DELETE: se um horário
 * for marcado com ele no meio do caminho, o banco não apaga, e o serviço sai
 * do cardápio no lugar.
 */
export async function removerServico(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");
  if (!id) return;

  const apagados = await prisma.servico.deleteMany({
    where: { id, usuarioId: usuario.id, agendamentos: { none: {} } },
  });

  if (apagados.count === 0) {
    await prisma.servico.updateMany({
      where: { id, usuarioId: usuario.id },
      data: { ativo: false },
    });
  }

  atualizarTelas();
}
