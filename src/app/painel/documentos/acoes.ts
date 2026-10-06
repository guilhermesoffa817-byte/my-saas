"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { LEITURAS_POR_MES_NO_VIP } from "@/lib/recursos";
import { deDataPura, inicioDoMes, paraCentavos } from "@/lib/formato";
import {
  TAMANHO_MAXIMO_BYTES,
  apagar,
  caminhoDoDocumento,
  enderecoParaEnviar,
  envioConfigurado,
  tipoAceito,
} from "@/lib/arquivos";
import { completarRepeticao } from "../vencimentos/acoes";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel");
  revalidatePath("/painel/documentos");
  revalidatePath("/painel/vencimentos");
}

/** Quantas leituras este estúdio já gastou no mês corrente. */
export async function leiturasDoMes(usuarioId: string) {
  return prisma.documento.count({
    where: {
      usuarioId,
      criadoEm: { gte: inicioDoMes(new Date()) },
      // Documento que nem chegou a ser lido não gasta a cota.
      situacao: { not: "falhou" },
    },
  });
}

/**
 * Primeiro passo do envio: cria a ficha e devolve o endereço assinado.
 *
 * O arquivo ainda não existe; ele vai do navegador direto para o espaço
 * privado. A ficha nasce aqui para que o caminho já comece pelo id do estúdio,
 * e para que o endereço assinado só exista depois dessa conferência.
 */
export async function pedirEnvio(entrada: {
  nome: string;
  tipo: string;
  tamanhoBytes: number;
}): Promise<
  | { certo: true; documentoId: string; endereco: string; caminho: string }
  | { certo: false; motivo: string }
> {
  const { usuario } = await exigirRecurso("documentos");

  if (!envioConfigurado()) {
    return {
      certo: false,
      motivo: "O envio de arquivos ainda não está configurado nesta conta.",
    };
  }
  if (!tipoAceito(entrada.tipo)) {
    return {
      certo: false,
      motivo: "Envie um PDF ou fotos das páginas, em JPG, PNG ou WEBP.",
    };
  }
  if (entrada.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
    return {
      certo: false,
      motivo: `Esse arquivo tem mais de ${Math.round(TAMANHO_MAXIMO_BYTES / 1024 / 1024)} MB. Tente separar em partes menores.`,
    };
  }

  const usadas = await leiturasDoMes(usuario.id);
  if (usadas >= LEITURAS_POR_MES_NO_VIP) {
    return {
      certo: false,
      motivo: `Você já usou as ${LEITURAS_POR_MES_NO_VIP} leituras deste mês. No mês que vem elas voltam.`,
    };
  }

  const documento = await prisma.documento.create({
    data: {
      usuarioId: usuario.id,
      nome: entrada.nome.slice(0, 160),
      caminho: "",
      tipoDoArquivo: entrada.tipo,
      tamanhoBytes: entrada.tamanhoBytes,
      situacao: "lendo",
    },
    select: { id: true },
  });

  const caminho = caminhoDoDocumento(usuario.id, documento.id, entrada.nome);
  const assinado = await enderecoParaEnviar(caminho);

  if (!assinado) {
    await prisma.documento.deleteMany({ where: { id: documento.id, usuarioId: usuario.id } });
    return { certo: false, motivo: "Não consegui preparar o envio. Tente de novo." };
  }

  await prisma.documento.update({
    where: { id: documento.id },
    data: { caminho },
  });

  return { certo: true, documentoId: documento.id, endereco: assinado.endereco, caminho };
}

/** Marca que o arquivo subiu e a leitura pode começar. */
export async function confirmarEnvio(documentoId: string) {
  const { usuario } = await exigirRecurso("documentos");

  await prisma.documento.updateMany({
    where: { id: documentoId, usuarioId: usuario.id },
    data: { situacao: "lendo", leituraEm: new Date(), motivoDaFalha: null },
  });

  atualizarTelas();
}

/* ------------------------------------------------------------------ */
/* Conferência                                                         */
/* ------------------------------------------------------------------ */

export async function salvarItem(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirRecurso("documentos");

  const id = texto(dados, "id");
  const descricao = texto(dados, "descricao");
  const valorTexto = texto(dados, "valor");
  const valorCentavos = valorTexto ? paraCentavos(valorTexto) : null;
  const data = texto(dados, "data") ? deDataPura(texto(dados, "data")) : null;

  // O item é buscado pela ficha do documento, que por sua vez é do estúdio da
  // sessão. Item de outro estúdio não é encontrado.
  const item = await prisma.itemDoDocumento.findFirst({
    where: { id, documento: { usuarioId: usuario.id } },
    select: { id: true },
  });
  if (!item) return { erro: "Não encontramos esse item." };

  if (descricao.length < 2) return { erro: "Escreva o que é este item." };
  if (valorTexto && !valorCentavos) return { erro: "Não entendi o valor. Pode conferir?" };
  if (texto(dados, "data") && !data) return { erro: "Não entendi a data. Pode conferir?" };

  await prisma.itemDoDocumento.update({
    where: { id: item.id },
    data: { descricao, valorCentavos, data, duvidoso: false },
  });

  atualizarTelas();
  return { recado: "Item corrigido." };
}

export async function descartarItem(dados: FormData) {
  const { usuario } = await exigirRecurso("documentos");
  const id = texto(dados, "id");

  await prisma.itemDoDocumento.updateMany({
    where: { id, documento: { usuarioId: usuario.id }, decisao: null },
    data: { decisao: "descartado" },
  });

  atualizarTelas();
}

/**
 * Aceita um item e cria o vencimento correspondente.
 *
 * Esta é a única porta entre o que a leitura encontrou e o financeiro do
 * estúdio. Nada atravessa sem passar por aqui, e nada atravessa duas vezes: a
 * condição `decisao: null` no próprio UPDATE garante isso.
 */
export async function aceitarItem(dados: FormData) {
  const { usuario } = await exigirRecurso("documentos");
  const id = texto(dados, "id");

  const item = await prisma.itemDoDocumento.findFirst({
    where: { id, documento: { usuarioId: usuario.id } },
    select: {
      id: true,
      descricao: true,
      tipo: true,
      valorCentavos: true,
      data: true,
      repeticao: true,
      repeteAte: true,
      decisao: true,
    },
  });
  if (!item || item.decisao) return;

  // Sem data não dá para virar vencimento: vencimento é, por definição, uma data.
  if (!item.data) return;

  let repeticaoId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const marcados = await tx.itemDoDocumento.updateMany({
      where: { id: item.id, decisao: null },
      data: { decisao: "aceito" },
    });
    if (marcados.count === 0) return;

    if (item.repeticao === "mensal") {
      const repeticao = await tx.repeticaoDeVencimento.create({
        data: {
          usuarioId: usuario.id,
          tipo: "conta",
          descricao: item.descricao,
          categoria: "Do documento",
          valorCentavos: item.valorCentavos,
          primeira: item.data!,
          ate: item.repeteAte,
        },
        select: { id: true },
      });
      repeticaoId = repeticao.id;
      await tx.itemDoDocumento.update({
        where: { id: item.id },
        data: { vencimentoId: repeticao.id },
      });
      return;
    }

    const vencimento = await tx.vencimento.create({
      data: {
        usuarioId: usuario.id,
        tipo: "conta",
        descricao: item.descricao,
        categoria: "Do documento",
        valorCentavos: item.valorCentavos,
        data: item.data!,
      },
      select: { id: true },
    });
    await tx.itemDoDocumento.update({
      where: { id: item.id },
      data: { vencimentoId: vencimento.id },
    });
  });

  // As ocorrências da repetição são geradas fora da transação, porque elas
  // chamam a mesma rotina que a tela de vencimentos usa.
  if (repeticaoId) await completarRepeticao(repeticaoId, usuario.id);

  atualizarTelas();
}

/** Fecha a conferência: o que sobrou sem decisão é dado por descartado. */
export async function encerrarConferencia(dados: FormData) {
  const { usuario } = await exigirRecurso("documentos");
  const id = texto(dados, "id");

  await prisma.$transaction(async (tx) => {
    const documento = await tx.documento.findFirst({
      where: { id, usuarioId: usuario.id },
      select: { id: true },
    });
    if (!documento) return;

    await tx.itemDoDocumento.updateMany({
      where: { documentoId: documento.id, decisao: null },
      data: { decisao: "descartado" },
    });
    await tx.documento.update({
      where: { id: documento.id },
      data: { situacao: "conferido" },
    });
  });

  atualizarTelas();
}

export async function excluirDocumento(dados: FormData) {
  const { usuario } = await exigirRecurso("documentos");
  const id = texto(dados, "id");

  const documento = await prisma.documento.findFirst({
    where: { id, usuarioId: usuario.id },
    select: { id: true, caminho: true },
  });
  if (!documento) return;

  // O arquivo sai junto com a ficha: guardar contrato de alguém depois de
  // apagado seria guardar CPF e endereço sem motivo nenhum.
  if (documento.caminho) await apagar([documento.caminho]);
  await prisma.documento.deleteMany({ where: { id: documento.id, usuarioId: usuario.id } });

  atualizarTelas();
}
