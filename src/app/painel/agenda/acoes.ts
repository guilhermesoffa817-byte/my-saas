"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { ausenciaNoDia } from "@/lib/equipe-operacoes";
import { ROTULO_DA_AUSENCIA, ehTipoDeAusencia } from "@/lib/equipe";
import {
  dataEHora,
  deDataPura,
  deHorarioLocal,
  hora,
  paraDataLocal,
  primeiroNome,
  somarDias,
} from "@/lib/formato";

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
  revalidatePath("/painel/cobrancas");
}

export async function marcarHorario(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const clienteId = texto(dados, "clienteId");
  const servicoId = texto(dados, "servicoId");
  const inicio = deHorarioLocal(texto(dados, "inicio"));
  const observacoes = texto(dados, "observacoes");
  const colaboradorId = texto(dados, "colaboradorId") || null;

  if (!clienteId) return { erro: "Escolha o cliente que vai ser atendido." };
  if (!servicoId) return { erro: "Escolha o serviço desse atendimento." };
  if (!inicio) return { erro: "Escolha o dia e a hora do atendimento." };

  const [cliente, servico] = await Promise.all([
    prisma.cliente.findFirst({ where: { id: clienteId, usuarioId: usuario.id } }),
    prisma.servico.findFirst({ where: { id: servicoId, usuarioId: usuario.id } }),
  ]);

  if (!cliente) return { erro: "Não encontramos esse cliente na sua lista." };
  if (!servico) return { erro: "Não encontramos esse serviço na sua lista." };

  if (colaboradorId) {
    const problema = await conferirQuemAtende(usuario, colaboradorId, inicio);
    if (problema) return { erro: problema };
  }

  const conflito = await horarioOcupado({
    usuarioId: usuario.id,
    inicio,
    duracaoMin: servico.duracaoMin,
    colaboradorId,
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
      colaboradorId,
    },
  });

  atualizarTelas();
  return { recado: `Marcado! ${cliente.nome} em ${dataEHora(inicio)}.` };
}

/**
 * "Quem atende" é da Equipe, que é do VIP. O id vem do formulário, então antes
 * de gravar confere-se que a pessoa é deste estúdio, trabalha nesse dia e não
 * tem ausência registrada nele.
 */
async function conferirQuemAtende(
  usuario: Parameters<typeof podeUsar>[0] & { id: string },
  colaboradorId: string,
  inicio: Date,
) {
  if (!podeUsar(usuario, "equipe")) {
    return "Escolher quem atende faz parte do plano VIP.";
  }
  const dia = paraDataLocal(inicio);
  const data = deDataPura(dia)!;
  const pessoa = await prisma.colaborador.findFirst({
    where: { id: colaboradorId, usuarioId: usuario.id, anonimizadoEm: null },
    select: { nome: true, inicio: true, fim: true },
  });
  if (!pessoa) return "Não encontramos essa pessoa na sua equipe.";
  if (pessoa.inicio > data || (pessoa.fim && pessoa.fim < data)) {
    return `${primeiroNome(pessoa.nome)} não está na equipe nesse dia. Escolha outra pessoa ou outro dia.`;
  }
  const ausencia = await ausenciaNoDia(prisma, usuario.id, colaboradorId, dia);
  if (ausencia) {
    const motivo = ehTipoDeAusencia(ausencia.tipo)
      ? ROTULO_DA_AUSENCIA[ausencia.tipo].toLowerCase()
      : "ausência";
    return `${primeiroNome(pessoa.nome)} está fora nesse dia (${motivo}). Escolha outra pessoa ou outro dia.`;
  }
  return null;
}

/**
 * Com equipe, duas pessoas atendem ao mesmo tempo. O choque de horário só vale
 * entre atendimentos da mesma pessoa; os sem "quem atende" são da própria dona
 * e se chocam entre si, como sempre foi para quem trabalha sozinha.
 */
async function horarioOcupado({
  usuarioId,
  inicio,
  duracaoMin,
  ignorarId,
  colaboradorId = null,
}: {
  usuarioId: string;
  inicio: Date;
  duracaoMin: number;
  ignorarId?: string;
  colaboradorId?: string | null;
}) {
  const fim = new Date(inicio.getTime() + duracaoMin * 60 * 1000);

  const candidatos = await prisma.agendamento.findMany({
    where: {
      usuarioId,
      colaboradorId,
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

  /*
    Cancelar o horário não cancela a cobrança por conta própria: o atendimento
    pode ter sido desmarcado e o valor seguir devido. A tela pergunta, e a
    resposta chega aqui. Sem resposta, a cobrança fica como está.
  */
  if (status === "cancelado" && texto(dados, "cobranca") === "cancelar") {
    await prisma.cobranca.updateMany({
      where: { agendamentoId: id, usuarioId: usuario.id, situacao: "aberta" },
      data: { situacao: "cancelada" },
    });
  }

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
