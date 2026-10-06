"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { criarSessao } from "@/lib/sessao";
import {
  codigoConfere,
  gerarCodigo,
  pedidoValido,
  resumoDoCodigo,
  validadeAPartirDe,
} from "@/lib/senha";

export type Resposta = { erro?: string; recado?: string } | null;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * A pessoa pede uma senha nova pela tela de entrada.
 *
 * A resposta é sempre a mesma, exista ou não a conta. Se ela mudasse, qualquer
 * um descobriria quais e-mails têm conta aqui só testando um por um.
 *
 * Nenhum link é gerado neste momento: o pedido fica aberto na administração,
 * que é quem gera o link e manda pelo WhatsApp. Enquanto não houver envio de
 * e-mail, é esse o caminho que funciona.
 */
export async function pedirNovaSenha(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const email = texto(dados, "email").toLowerCase();

  const mesmaRespostaSempre = {
    recado:
      "Pedido registrado. Vamos te mandar o link da senha nova pelo WhatsApp do seu cadastro. Se não chegar em alguns minutos, chame a gente.",
  };

  if (!EMAIL_VALIDO.test(email)) {
    return { erro: "Esse e-mail parece incompleto. Pode escrevê-lo novamente?" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!usuario) return mesmaRespostaSempre;

  // Já existe um pedido aberto e no prazo: aproveita, em vez de encher a
  // administração com uma linha por toque no botão.
  const aberto = await prisma.pedidoDeSenha.findFirst({
    where: { usuarioId: usuario.id, usadoEm: null, expiraEm: { gt: new Date() } },
    select: { id: true },
  });
  if (aberto) return mesmaRespostaSempre;

  await prisma.pedidoDeSenha.create({
    data: {
      usuarioId: usuario.id,
      // Sem código ainda: ele nasce quando a administração gera o link.
      expiraEm: validadeAPartirDe(),
    },
  });

  revalidatePath("/painel/admin");
  return mesmaRespostaSempre;
}

/**
 * A administração gera o link de uma conta.
 *
 * O código volta uma única vez, aqui, para ser copiado e mandado. Depois disso
 * só existe o resumo dele no banco, e nem quem abrir o banco consegue refazê-lo.
 */
export async function gerarLinkDeSenha(
  usuarioId: string,
): Promise<{ certo: true; codigo: string } | { certo: false; motivo: string }> {
  await exigirAdmin();

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true },
  });
  if (!usuario) return { certo: false, motivo: "Não encontramos essa conta." };

  const codigo = gerarCodigo();

  await prisma.$transaction(async (tx) => {
    // Gerar um link novo derruba os anteriores: só o último vale.
    await tx.pedidoDeSenha.updateMany({
      where: { usuarioId, usadoEm: null },
      data: { usadoEm: new Date() },
    });

    await tx.pedidoDeSenha.create({
      data: {
        usuarioId,
        codigoHash: resumoDoCodigo(codigo),
        entregueEm: new Date(),
        expiraEm: validadeAPartirDe(),
      },
    });
  });

  revalidatePath("/painel/admin");
  return { certo: true, codigo };
}

/** Confere se um código de link ainda serve, sem gastá-lo. */
export async function conferirCodigo(codigo: string) {
  if (!codigo || codigo.length < 20) return null;

  const pedido = await prisma.pedidoDeSenha.findUnique({
    where: { codigoHash: resumoDoCodigo(codigo) },
    select: {
      id: true,
      expiraEm: true,
      usadoEm: true,
      codigoHash: true,
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });

  if (!pedido?.codigoHash) return null;
  // Comparação em tempo constante mesmo depois de achar pelo índice.
  if (!codigoConfere(codigo, pedido.codigoHash)) return null;
  if (!pedidoValido(pedido)) return null;

  return pedido;
}

/** A pessoa escolhe a senha nova pelo link. */
export async function trocarSenha(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const codigo = texto(dados, "codigo");
  const senha = texto(dados, "senha");
  const repetida = texto(dados, "repetida");

  if (senha.length < 8) {
    return { erro: "Para ficar seguro, a senha precisa de pelo menos 8 caracteres." };
  }
  if (senha !== repetida) {
    return { erro: "As duas senhas não são iguais. Pode conferir?" };
  }

  const pedido = await conferirCodigo(codigo);
  if (!pedido) {
    return {
      erro: "Esse link não vale mais. Peça outro na tela de entrada e a gente te manda um novo.",
    };
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  let versao = 0;

  await prisma.$transaction(async (tx) => {
    /*
      A condição `usadoEm: null` no próprio UPDATE é o que impede o mesmo link
      de trocar a senha duas vezes. Se dois toques chegarem juntos, o segundo
      muda zero linhas e para aqui.
    */
    const gastos = await tx.pedidoDeSenha.updateMany({
      where: { id: pedido.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    if (gastos.count === 0) return;

    // Qualquer outro link pendente desta conta também morre agora.
    await tx.pedidoDeSenha.updateMany({
      where: { usuarioId: pedido.usuario.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });

    const atualizado = await tx.usuario.update({
      where: { id: pedido.usuario.id },
      data: { senhaHash, sessaoVersao: { increment: 1 } },
      select: { sessaoVersao: true },
    });
    versao = atualizado.sessaoVersao;
  });

  if (versao === 0) {
    return { erro: "Esse link já foi usado. Peça outro na tela de entrada." };
  }

  // Entra já com a senha nova, com a versão nova: as sessões antigas caíram.
  await criarSessao(pedido.usuario.id, versao);

  /*
    Vai direto para o painel, e não devolve um recado.
    Criar a sessão escreve um cookie, e escrever cookie faz o Next recarregar a
    tela atual. Esta tela é a do link, que acabou de ser gasto, então ela
    recarregaria dizendo "esse link não vale mais" por cima do aviso de sucesso:
    a pessoa trocaria a senha certinho e levaria um susto.
  */
  redirect("/painel");
}
