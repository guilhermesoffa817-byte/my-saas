"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { dataEHora, deHorarioLocal, hora, somarDias } from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

const STATUS_VALIDOS = ["agendado", "concluido", "cancelado"] as const;
type Status = (typeof STATUS_VALIDOS)[number];

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/clientes");
}

export async function marcarHorario(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const clienteId = texto(dados, "clienteId");
  const servicoId = texto(dados, "servicoId");
  const inicio = deHorarioLocal(texto(dados, "inicio"));
  const observacoes = texto(dados, "observacoes");

  if (!clienteId) return { erro: "Escolha a cliente que vai ser atendida." };
  if (!servicoId) return { erro: "Escolha o serviço desse atendimento." };
  if (!inicio) return { erro: "Escolha o dia e a hora do atendimento." };

  const [cliente, servico] = await Promise.all([
    prisma.cliente.findFirst({ where: { id: clienteId, usuarioId: usuario.id } }),
    prisma.servico.findFirst({ where: { id: servicoId, usuarioId: usuario.id } }),
  ]);

  if (!cliente) return { erro: "Não encontramos essa cliente na sua lista." };
  if (!servico) return { erro: "Não encontramos esse serviço na sua lista." };

  const conflito = await horarioOcupado({
    usuarioId: usuario.id,
    inicio,
    duracaoMin: servico.duracaoMin,
  });

  if (conflito) {
    return {
      erro: `Esse horário esbarra no atendimento de ${conflito.cliente.nome}, às ${hora(conflito.inicio)}. Que tal outro horário?`,
    };
  }

  await prisma.agendamento.create({
    data: {
      usuarioId: usuario.id,
      clienteId,
      servicoId,
      inicio,
      observacoes: observacoes || null,
    },
  });

  atualizarTelas();
  return { recado: `Marcado! ${cliente.nome} em ${dataEHora(inicio)}.` };
}

async function horarioOcupado({
  usuarioId,
  inicio,
  duracaoMin,
  ignorarId,
}: {
  usuarioId: string;
  inicio: Date;
  duracaoMin: number;
  ignorarId?: string;
}) {
  const fim = new Date(inicio.getTime() + duracaoMin * 60 * 1000);

  const candidatos = await prisma.agendamento.findMany({
    where: {
      usuarioId,
      status: { not: "cancelado" },
      inicio: { gte: somarDias(inicio, -1), lte: somarDias(inicio, 1) },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    include: { cliente: true, servico: true },
  });

  return candidatos.find((item) => {
    const fimExistente = new Date(
      item.inicio.getTime() + item.servico.duracaoMin * 60 * 1000,
    );
    return item.inicio < fim && inicio < fimExistente;
  });
}

export async function mudarStatus(dados: FormData) {
  const { usuario } = await exigirAcesso();

  const id = texto(dados, "id");
  const status = texto(dados, "status") as Status;
  if (!STATUS_VALIDOS.includes(status)) return;

  const agendamento = await prisma.agendamento.findFirst({
    where: { id, usuarioId: usuario.id },
  });
  if (!agendamento) return;

  await prisma.agendamento.update({ where: { id }, data: { status } });
  atualizarTelas();
}

export async function excluirAgendamento(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");

  const agendamento = await prisma.agendamento.findFirst({
    where: { id, usuarioId: usuario.id },
  });
  if (!agendamento) return;

  await prisma.agendamento.delete({ where: { id } });
  atualizarTelas();
}
