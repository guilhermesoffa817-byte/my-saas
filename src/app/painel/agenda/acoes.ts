"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { travarAgendaDoEstudio } from "@/lib/agenda-trava";
import { exigirEscrita } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { ausenciaNoDia } from "@/lib/equipe-operacoes";
import {
  STATUS_DO_HORARIO,
  apagarHorario,
  horarioOcupado,
  mudarStatusDoHorario,
  type StatusDoHorario,
} from "@/lib/agenda-operacoes";
import { ROTULO_DA_AUSENCIA, ehTipoDeAusencia } from "@/lib/equipe";
import {
  dataEHora,
  deDataPura,
  deHorarioLocal,
  hora,
  paraDataLocal,
  primeiroNome,
} from "@/lib/formato";

export type Resposta = { erro?: string; recado?: string } | null;

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
  const { usuario } = await exigirEscrita();

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

  /*
    Conferir e gravar acontecem dentro da mesma transação, com a agenda do
    estúdio travada: um cliente marcando pelo link no mesmo segundo espera
    esta gravação terminar e, quando confere, já vê o horário ocupado.
  */
  const conflito = await prisma.$transaction(async (tx) => {
    await travarAgendaDoEstudio(tx, usuario.id);
    const encontrado = await horarioOcupado(tx, {
      usuarioId: usuario.id,
      inicio,
      duracaoMin: servico.duracaoMin,
      colaboradorId,
    });
    if (encontrado) return encontrado;

    await tx.agendamento.create({
      data: {
        usuarioId: usuario.id,
        clienteId,
        servicoId,
        inicio,
        observacoes: observacoes || null,
        colaboradorId,
        precoCentavos: servico.precoCentavos,
      },
    });
    return null;
  });

  if (conflito) {
    return {
      erro: `Esse horário esbarra no atendimento de ${conflito.cliente.nome}, às ${hora(conflito.inicio)}. Que tal outro horário?`,
    };
  }

  atualizarTelas();
  return { recado: `Marcado! ${cliente.nome} em ${dataEHora(inicio)}.` };
}

/**
 * "Quem atende" é da Equipe, que é do Completo. O id vem do formulário, então antes
 * de gravar confere-se que a pessoa é deste estúdio, trabalha nesse dia e não
 * tem ausência registrada nele.
 */
async function conferirQuemAtende(
  usuario: Parameters<typeof podeUsar>[0] & { id: string },
  colaboradorId: string,
  inicio: Date,
) {
  if (!podeUsar(usuario, "equipe")) {
    return "Escolher quem atende faz parte do plano Completo.";
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

export async function mudarStatus(dados: FormData) {
  const { usuario } = await exigirEscrita();

  const id = texto(dados, "id");
  const status = texto(dados, "status") as StatusDoHorario;
  if (!STATUS_DO_HORARIO.includes(status)) return;

  // Concluir ou desfazer a conclusão mexe no dinheiro do mês: passa pela trava.
  const feito = await mudarStatusDoHorario(prisma, usuario.id, {
    id,
    status,
    cancelarCobranca: texto(dados, "cobranca") === "cancelar",
  });
  if ("erro" in feito) {
    if (feito.motivo === "ocupado") voltarComAviso(feito.inicio, "horario-ocupado");
    voltarComMesFechado(feito.inicio);
  }

  atualizarTelas();
}

export async function excluirAgendamento(dados: FormData) {
  const { usuario } = await exigirEscrita();
  const id = texto(dados, "id");

  const apagado = await apagarHorario(prisma, usuario.id, id);
  if ("erro" in apagado) voltarComMesFechado(apagado.inicio);

  atualizarTelas();
}

/** Volta para o dia do horário com o recado do mês fechado. */
function voltarComMesFechado(inicio: Date): never {
  voltarComAviso(inicio, "mes-fechado");
}

/** Volta para o dia do horário com um recado: mês fechado ou horário já ocupado. */
function voltarComAviso(inicio: Date, aviso: "mes-fechado" | "horario-ocupado"): never {
  redirect(`/painel/agenda?dia=${paraDataLocal(inicio)}&aviso=${aviso}`);
}
