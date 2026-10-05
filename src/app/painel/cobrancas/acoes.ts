"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import {
  deDataPura,
  hojeNoEstudio,
  paraCentavos,
  paraDataPura,
} from "@/lib/formato";
import {
  lembreteDeHoje,
  type CodigoDoMomento,
  type PreferenciaDeLembrete,
} from "@/lib/cobranca";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel");
  revalidatePath("/painel/cobrancas");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/financas");
}

/** Marca de que o banco recusou por causa do índice que impede cobrança em dobro. */
function ehDuplicada(erro: unknown) {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    (erro as { code?: string }).code === "P2002"
  );
}

/* ------------------------------------------------------------------ */
/* Criar                                                               */
/* ------------------------------------------------------------------ */

export async function criarCobranca(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const clienteId = texto(dados, "clienteId");
  const agendamentoId = texto(dados, "agendamentoId");
  const valorCentavos = paraCentavos(texto(dados, "valor"));
  const vencimento = deDataPura(texto(dados, "vencimento"));

  if (!clienteId) return { erro: "Escolha o cliente desta cobrança." };
  if (!valorCentavos || valorCentavos <= 0) {
    return { erro: "Informe um valor maior que zero, como 120,00." };
  }
  if (!vencimento) {
    return { erro: "Não consegui entender a data de vencimento. Pode conferir?" };
  }

  // Cliente e horário precisam ser deste estúdio. A conferência é aqui, no
  // servidor, com o id que veio da sessão, nunca com um id vindo da tela.
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, usuarioId: usuario.id },
    select: { id: true },
  });
  if (!cliente) return { erro: "Não encontramos esse cliente na sua lista." };

  if (agendamentoId) {
    const agendamento = await prisma.agendamento.findFirst({
      where: { id: agendamentoId, usuarioId: usuario.id },
      select: { id: true },
    });
    if (!agendamento) return { erro: "Não encontramos esse horário na sua agenda." };
  }

  try {
    const cobranca = await prisma.cobranca.create({
      data: {
        usuarioId: usuario.id,
        clienteId,
        agendamentoId: agendamentoId || null,
        valorCentavos,
        vencimento,
      },
      select: { id: true },
    });

    atualizarTelas();
    return { recado: `Cobrança criada. Agora é só enviar a mensagem.|${cobranca.id}` };
  } catch (erro) {
    if (ehDuplicada(erro)) {
      // O índice parcial do banco barrou: já existe cobrança viva para este
      // horário. Acontece no toque duplo, e é exatamente o que ele evita.
      return { erro: "Esse horário já tem uma cobrança. Veja em Cobranças." };
    }
    throw erro;
  }
}

/* ------------------------------------------------------------------ */
/* Lembrete                                                            */
/* ------------------------------------------------------------------ */

/**
 * Registra que a mensagem foi enviada.
 *
 * O Bossa não tem como saber se a mensagem saiu do WhatsApp: o link só abre o
 * aplicativo com o texto pronto. Por isso quem confirma é a pessoa, de volta na
 * tela, e só então o lembrete é gravado.
 *
 * Grava todos os momentos que já estavam vencidos, não só o escolhido. Sem
 * isso, uma cobrança atrasada voltaria amanhã pedindo um aviso mais brando do
 * que o que acabou de ser mandado.
 */
export async function registrarLembrete(dados: FormData) {
  const { usuario } = await exigirAcesso();
  if (!podeUsar(usuario, "lembretes")) return;

  const id = texto(dados, "id");

  const cobranca = await prisma.cobranca.findFirst({
    where: { id, usuarioId: usuario.id, situacao: "aberta" },
    select: {
      id: true,
      vencimento: true,
      lembretes: { select: { momento: true } },
    },
  });
  if (!cobranca) return;

  const preferencias: PreferenciaDeLembrete = {
    antes: usuario.lembreteAntes,
    no_dia: usuario.lembreteNoDia,
    tres_dias: usuario.lembreteTresDias,
    sete_dias: usuario.lembreteSeteDias,
  };

  const escolha = lembreteDeHoje({
    vencimento: cobranca.vencimento,
    hoje: hojeNoEstudio(),
    preferencias,
    jaEnviados: cobranca.lembretes.map((item) => item.momento as CodigoDoMomento),
  });

  // Sem momento vencido não há o que registrar. Também cobre o toque duplo:
  // na segunda vez já não sobra momento pendente.
  if (!escolha) return;

  await prisma.lembreteDeCobranca.createMany({
    data: escolha.cobre.map((momento) => ({ cobrancaId: cobranca.id, momento })),
    // O par cobrança e momento é único no banco; ignorar o repetido deixa a
    // ação dar o mesmo resultado se for acionada duas vezes.
    skipDuplicates: true,
  });

  atualizarTelas();
}

/* ------------------------------------------------------------------ */
/* Receber                                                             */
/* ------------------------------------------------------------------ */

const FORMAS = ["pix", "dinheiro", "cartao", "outra"] as const;

export async function marcarComoPaga(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const id = texto(dados, "id");
  const forma = texto(dados, "forma");
  const pagaEm = deDataPura(texto(dados, "pagaEm") || paraDataPura(hojeNoEstudio()));

  if (!FORMAS.includes(forma as (typeof FORMAS)[number])) {
    return { erro: "Escolha como o cliente pagou." };
  }
  if (!pagaEm) return { erro: "Não consegui entender a data do pagamento." };

  const cobranca = await prisma.cobranca.findFirst({
    where: { id, usuarioId: usuario.id },
    select: {
      id: true,
      situacao: true,
      valorCentavos: true,
      agendamentoId: true,
      cliente: { select: { nome: true } },
    },
  });
  if (!cobranca) return { erro: "Não encontramos essa cobrança." };
  if (cobranca.situacao === "paga") {
    return { recado: "Essa cobrança já estava marcada como paga." };
  }
  if (cobranca.situacao === "cancelada") {
    return { erro: "Essa cobrança foi cancelada. Crie outra se precisar cobrar de novo." };
  }

  await prisma.$transaction(async (tx) => {
    /*
      A condição `situacao: "aberta"` dentro do próprio UPDATE é o que impede o
      dinheiro de entrar duas vezes. Se dois toques chegarem juntos, o primeiro
      muda uma linha e o segundo muda zero; só quem mudou linha segue adiante e
      cria o lançamento.
    */
    const mudadas = await tx.cobranca.updateMany({
      where: { id: cobranca.id, usuarioId: usuario.id, situacao: "aberta" },
      data: { situacao: "paga", formaDePagamento: forma, pagaEm },
    });
    if (mudadas.count === 0) return;

    /*
      Onde este dinheiro aparece no faturamento depende de onde ele nasceu.

      Cobrança que veio de um horário da agenda NÃO vira lançamento: o
      faturamento do mês já soma o preço do serviço de todo atendimento
      concluído. Criar um lançamento aqui contaria o mesmo dinheiro duas vezes
      e mudaria o sentido de um número que a pessoa já conhece.

      Cobrança solta, criada pela ficha do cliente, não tem atendimento por
      trás, então ela precisa virar entrada para aparecer no mês.
    */
    if (cobranca.agendamentoId) return;

    const lancamento = await tx.lancamento.create({
      data: {
        usuarioId: usuario.id,
        tipo: "entrada",
        descricao: `Cobrança de ${cobranca.cliente.nome}`,
        categoria: "Cobrança",
        valorCentavos: cobranca.valorCentavos,
        data: pagaEm,
      },
      select: { id: true },
    });

    await tx.cobranca.update({
      where: { id: cobranca.id },
      data: { lancamentoId: lancamento.id },
    });
  });

  atualizarTelas();
  return { recado: "Pagamento registrado. Obrigado por manter a conta em dia." };
}

/* ------------------------------------------------------------------ */
/* Cancelar                                                            */
/* ------------------------------------------------------------------ */

export async function cancelarCobranca(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");

  await prisma.cobranca.updateMany({
    where: { id, usuarioId: usuario.id, situacao: "aberta" },
    data: { situacao: "cancelada" },
  });

  atualizarTelas();
}

/* ------------------------------------------------------------------ */
/* Ajustes do estúdio                                                  */
/* ------------------------------------------------------------------ */

export async function salvarAjustesDeCobranca(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirAcesso();

  const pixChave = texto(dados, "pixChave");
  const pixCidade = texto(dados, "pixCidade");

  if (pixChave && !pixCidade) {
    return { erro: "O código Pix também precisa da cidade de quem recebe." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      pixChave: pixChave || null,
      pixCidade: pixCidade || null,
      lembreteAntes: dados.get("lembreteAntes") === "on",
      lembreteNoDia: dados.get("lembreteNoDia") === "on",
      lembreteTresDias: dados.get("lembreteTresDias") === "on",
      lembreteSeteDias: dados.get("lembreteSeteDias") === "on",
    },
  });

  atualizarTelas();
  return { recado: "Ajustes salvos." };
}

export async function mudarLembretesDoCliente(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");
  const semLembretes = texto(dados, "semLembretes") === "1";

  await prisma.cliente.updateMany({
    where: { id, usuarioId: usuario.id },
    data: { semLembretes },
  });

  atualizarTelas();
}
