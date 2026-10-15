"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { situacaoValida } from "@/lib/atendimento";
import { dataEHora, deHorarioLocal, emReais, hora } from "@/lib/formato";
import { horarioOcupado } from "./ocupacao";
import { podeMudarDeSituacao, valorAoRemarcar } from "./regras";

export type Resposta = {
  erro?: string;
  recado?: string;
  /** O horário esbarra em outro: a tela oferece marcar mesmo assim, como encaixe. */
  conflito?: boolean;
  /**
   * O que a pessoa enviou. Depois de uma ação, o React limpa o formulário; sem
   * isto, um erro apagaria cliente, serviço e hora já escolhidos.
   */
  valores?: Record<string, string>;
} | null;

/** Observação é recado curto. Um texto enorme só atrapalharia a agenda. */
const LIMITE_DA_OBSERVACAO = 500;

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

function mensagemDeConflito(conflito: { inicio: Date; cliente: { nome: string } }) {
  return `Esse horário esbarra no atendimento de ${conflito.cliente.nome}, às ${hora(conflito.inicio)}. Escolha outro horário ou marque como encaixe.`;
}

export async function marcarHorario(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const valores = {
    clienteId: texto(dados, "clienteId"),
    servicoId: texto(dados, "servicoId"),
    inicio: texto(dados, "inicio"),
    observacoes: texto(dados, "observacoes"),
  };
  const { clienteId, servicoId, observacoes } = valores;
  const inicio = deHorarioLocal(valores.inicio);
  // O servidor só pula a conferência quando a caixa do encaixe veio marcada.
  const encaixe = dados.get("encaixe") === "sim";

  if (!clienteId) return { erro: "Escolha o cliente que vai ser atendido.", valores };
  if (!servicoId) return { erro: "Escolha o serviço desse atendimento.", valores };
  if (!inicio) return { erro: "Escolha o dia e a hora do atendimento.", valores };
  if (observacoes.length > LIMITE_DA_OBSERVACAO) {
    return { erro: "A observação ficou longa demais. Resuma em poucas linhas.", valores };
  }

  const [cliente, servico] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id: clienteId, usuarioId: usuario.id },
      select: { nome: true, arquivadoEm: true },
    }),
    prisma.servico.findFirst({
      where: { id: servicoId, usuarioId: usuario.id },
      select: { precoCentavos: true, duracaoMin: true, ativo: true },
    }),
  ]);

  if (!cliente) return { erro: "Não encontramos esse cliente na sua lista.", valores };
  if (cliente.arquivadoEm) {
    return { erro: "Esse cliente está arquivado. Escolha outro da lista.", valores };
  }
  if (!servico) return { erro: "Não encontramos esse serviço na sua lista.", valores };
  if (!servico.ativo) {
    return { erro: "Esse serviço está pausado. Escolha outro da lista.", valores };
  }

  if (!encaixe) {
    const conflito = await horarioOcupado(prisma, {
      usuarioId: usuario.id,
      inicio,
      duracaoMin: servico.duracaoMin,
    });
    if (conflito) return { erro: mensagemDeConflito(conflito), conflito: true, valores };
  }

  await prisma.agendamento.create({
    data: {
      usuarioId: usuario.id,
      clienteId,
      servicoId,
      inicio,
      // O preço de hoje fica guardado no horário. Se o serviço subir de preço
      // amanhã, este atendimento continua valendo o que foi combinado.
      valorCentavos: servico.precoCentavos,
      observacoes: observacoes || null,
    },
  });

  atualizarTelas();
  return {
    recado: `${encaixe ? "Encaixe marcado!" : "Marcado!"} ${cliente.nome} em ${dataEHora(inicio)}.`,
  };
}

/**
 * Remarca um horário: muda o dia e a hora, o serviço e a observação.
 *
 * Só vale para quem ainda está agendado. Atendimento concluído é história, e
 * falta ou cancelamento se desfazem pelo "voltar para agendado" antes.
 */
export async function remarcarHorario(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const id = texto(dados, "id");
  const valores = {
    servicoId: texto(dados, "servicoId"),
    inicio: texto(dados, "inicio"),
    observacoes: texto(dados, "observacoes"),
  };
  const { servicoId, observacoes } = valores;
  const inicio = deHorarioLocal(valores.inicio);
  const encaixe = dados.get("encaixe") === "sim";

  if (!id) return { erro: "Não encontramos esse horário na sua agenda." };
  if (!servicoId) return { erro: "Escolha o serviço desse atendimento.", valores };
  if (!inicio) return { erro: "Escolha o novo dia e a nova hora.", valores };
  if (observacoes.length > LIMITE_DA_OBSERVACAO) {
    return { erro: "A observação ficou longa demais. Resuma em poucas linhas.", valores };
  }

  const atual = await prisma.agendamento.findFirst({
    where: { id, usuarioId: usuario.id },
    select: {
      inicio: true,
      status: true,
      servicoId: true,
      valorCentavos: true,
      cliente: { select: { nome: true } },
      cobrancas: { where: { situacao: "aberta" }, select: { valorCentavos: true } },
    },
  });

  if (!atual) return { erro: "Não encontramos esse horário na sua agenda." };
  if (atual.status !== "agendado") {
    return { erro: "Só dá para remarcar um horário que ainda está agendado.", valores };
  }

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, usuarioId: usuario.id },
    select: { id: true, precoCentavos: true, duracaoMin: true, ativo: true },
  });

  if (!servico) return { erro: "Não encontramos esse serviço na sua lista.", valores };
  // O serviço de sempre continua valendo mesmo pausado; trocar, só por um ativo.
  if (servico.id !== atual.servicoId && !servico.ativo) {
    return { erro: "Esse serviço está pausado. Escolha outro da lista.", valores };
  }

  if (!encaixe) {
    const conflito = await horarioOcupado(prisma, {
      usuarioId: usuario.id,
      inicio,
      duracaoMin: servico.duracaoMin,
      ignorarId: id,
    });
    if (conflito) return { erro: mensagemDeConflito(conflito), conflito: true, valores };
  }

  const valorCentavos = valorAoRemarcar(atual, servico);
  const mudouOHorario = atual.inicio.getTime() !== inicio.getTime();

  // A condição de estar agendado vai junto na escrita: se alguém concluiu o
  // atendimento em outra aba no meio do caminho, nada é remarcado.
  const mudados = await prisma.agendamento.updateMany({
    where: { id, usuarioId: usuario.id, status: "agendado" },
    data: {
      inicio,
      servicoId: servico.id,
      valorCentavos,
      observacoes: observacoes || null,
      // A confirmação enviada falava do horário antigo. Com outro horário,
      // ela precisa ser mandada de novo.
      ...(mudouOHorario ? { confirmacaoEnviadaEm: null } : {}),
    },
  });

  if (mudados.count === 0) {
    return { erro: "Só dá para remarcar um horário que ainda está agendado.", valores };
  }

  atualizarTelas();

  const cobrancaAberta = atual.cobrancas[0];
  const avisoDaCobranca =
    cobrancaAberta && valorCentavos !== null && cobrancaAberta.valorCentavos !== valorCentavos
      ? ` A cobrança em aberto continua de ${emReais(cobrancaAberta.valorCentavos)}.`
      : "";

  return {
    recado: `Remarcado! ${atual.cliente.nome} em ${dataEHora(inicio)}.${avisoDaCobranca}`,
  };
}

export async function mudarStatus(dados: FormData) {
  const { usuario } = await exigirAcesso();

  const id = texto(dados, "id");
  const status = texto(dados, "status");
  if (!id || !situacaoValida(status)) return;

  const agendamento = await prisma.agendamento.findFirst({
    where: { id, usuarioId: usuario.id },
    select: { status: true },
  });
  if (!agendamento || !podeMudarDeSituacao(agendamento.status, status)) return;

  /*
    Voltar para agendado não confere conflito de propósito. Falta e
    cancelamento liberam o horário, e alguém pode ter sido marcado no lugar;
    quem desfaz está corrigindo um toque errado, e os dois horários ficam na
    agenda como um encaixe, à vista, em vez de o botão não fazer nada.

    A situação lida entra na escrita: dois toques seguidos não trocam duas vezes.
  */
  const mudados = await prisma.agendamento.updateMany({
    where: { id, usuarioId: usuario.id, status: agendamento.status },
    data: { status },
  });
  if (mudados.count === 0) return;

  /*
    Cancelar o horário não cancela a cobrança por conta própria: o atendimento
    pode ter sido desmarcado e o valor seguir devido. A tela pergunta, e a
    resposta chega aqui. Sem resposta, a cobrança fica como está. A falta
    também não mexe na cobrança: há estúdio que cobra o horário perdido.
  */
  if (status === "cancelado" && texto(dados, "cobranca") === "cancelar") {
    await prisma.cobranca.updateMany({
      where: { agendamentoId: id, usuarioId: usuario.id, situacao: "aberta" },
      data: { situacao: "cancelada" },
    });
  }

  atualizarTelas();
}

/**
 * Guarda que a confirmação do horário foi enviada pelo WhatsApp.
 *
 * O Bossa não vê o que sai do WhatsApp: o link só abre a conversa com o texto
 * pronto. Por isso quem avisa que mandou é a pessoa, e ela pode desfazer se
 * tocou sem querer.
 */
export async function marcarConfirmacao(dados: FormData) {
  const { usuario } = await exigirAcesso();

  const id = texto(dados, "id");
  const enviada = texto(dados, "enviada");
  if (!id || (enviada !== "sim" && enviada !== "nao")) return;

  await prisma.agendamento.updateMany({
    where: {
      id,
      usuarioId: usuario.id,
      status: "agendado",
      // Tocar duas vezes em "Já mandei" não muda a hora do primeiro envio.
      ...(enviada === "sim" ? { confirmacaoEnviadaEm: null } : {}),
    },
    data: { confirmacaoEnviadaEm: enviada === "sim" ? new Date() : null },
  });

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
