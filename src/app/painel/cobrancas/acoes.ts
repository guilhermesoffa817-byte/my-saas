"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscrita } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { deDataPura, hojeNoEstudio, paraCentavos, paraDataPura } from "@/lib/formato";
import { FORMAS_DE_PAGAMENTO, receberCobranca } from "@/lib/cobranca-operacoes";
import { chaveParaGuardar, chavePorExtenso, ehTipoDeChave, lerChavePix } from "@/lib/pix";
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
  const { usuario } = await exigirEscrita();

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
  const { usuario } = await exigirEscrita();
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

export async function marcarComoPaga(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscrita();

  const id = texto(dados, "id");
  const forma = texto(dados, "forma");
  const pagaEm = deDataPura(texto(dados, "pagaEm") || paraDataPura(hojeNoEstudio()));

  if (!FORMAS_DE_PAGAMENTO.includes(forma as (typeof FORMAS_DE_PAGAMENTO)[number])) {
    return { erro: "Escolha como o cliente pagou." };
  }
  if (!pagaEm) return { erro: "Não consegui entender a data do pagamento." };

  // A trava do mês fechado e a proteção contra toque duplo moram em receberCobranca.
  const recebida = await receberCobranca(prisma, usuario.id, { id, forma, pagaEm });
  if ("erro" in recebida) return { erro: recebida.erro };
  if (recebida.resultado === "ja_paga") {
    return { recado: "Essa cobrança já estava marcada como paga." };
  }

  atualizarTelas();
  return { recado: "Pagamento registrado. Obrigado por manter a conta em dia." };
}

/* ------------------------------------------------------------------ */
/* Cancelar                                                            */
/* ------------------------------------------------------------------ */

export async function cancelarCobranca(dados: FormData) {
  const { usuario } = await exigirEscrita();
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

export type CamposDosAjustes = { pixChave: string; pixCidade: string; pixTipo: string };

export type RespostaDosAjustes =
  | ({ erro?: string; recado?: string } & {
      /** Depois de um erro, o formulário volta com o que a pessoa digitou. */
      campos?: CamposDosAjustes;
      /** A chave serve para mais de um tipo: a tela destaca a escolha do tipo. */
      pedeTipo?: boolean;
    })
  | null;

export async function salvarAjustesDeCobranca(
  _anterior: RespostaDosAjustes,
  dados: FormData,
): Promise<RespostaDosAjustes> {
  const { usuario } = await exigirEscrita();

  const pixChave = texto(dados, "pixChave");
  const pixCidade = texto(dados, "pixCidade");
  const tipoEscolhido = texto(dados, "pixTipo");
  const campos = { pixChave, pixCidade, pixTipo: tipoEscolhido };

  if (pixChave && !pixCidade) {
    return { erro: "O código Pix também precisa da cidade de quem recebe.", campos };
  }

  /*
    A chave é conferida aqui, ao salvar, e não só na hora de cobrar: um CPF
    lido como celular mandava o Pix de todas as cobranças para o telefone de
    outra pessoa, sem aviso. Ela fica guardada num formato que não deixa dúvida
    (CPF com pontos e hífen, celular com +55), e o recado diz o que foi entendido.
  */
  let chaveGuardada: string | null = null;
  let entendida = "";
  if (pixChave) {
    const lida = lerChavePix(pixChave, ehTipoDeChave(tipoEscolhido) ? tipoEscolhido : null);
    if (!lida.certo) {
      return { erro: lida.mensagem, campos, pedeTipo: lida.motivo === "ambigua" };
    }
    chaveGuardada = chaveParaGuardar(lida);
    entendida = chavePorExtenso(lida);
  }

  /*
    Caixa de seleção desabilitada não é enviada pelo navegador, e ausência aqui
    significaria "desmarcada". Quem está num plano sem lembretes vê as caixas
    travadas; se as preferências fossem gravadas mesmo assim, salvar a chave Pix
    apagaria em silêncio a configuração de lembrete de quem um dia assinou o Completo.
    Por isso as preferências só são tocadas por quem pode mexer nelas.
  */
  const preferencias = podeUsar(usuario, "lembretes")
    ? {
        lembreteAntes: dados.get("lembreteAntes") === "on",
        lembreteNoDia: dados.get("lembreteNoDia") === "on",
        lembreteTresDias: dados.get("lembreteTresDias") === "on",
        lembreteSeteDias: dados.get("lembreteSeteDias") === "on",
      }
    : {};

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      pixChave: chaveGuardada,
      pixCidade: pixCidade || null,
      ...preferencias,
    },
  });

  atualizarTelas();
  revalidatePath("/painel/cobrancas/ajustes");
  return {
    recado: entendida ? `Ajustes salvos. Sua chave Pix ficou assim: ${entendida}.` : "Ajustes salvos.",
  };
}

export async function mudarLembretesDoCliente(dados: FormData) {
  const { usuario } = await exigirEscrita();
  const id = texto(dados, "id");
  const semLembretes = texto(dados, "semLembretes") === "1";

  await prisma.cliente.updateMany({
    where: { id, usuarioId: usuario.id },
    data: { semLembretes },
  });

  atualizarTelas();
}
