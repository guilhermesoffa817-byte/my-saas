"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarSessao, encerrarSessao } from "@/lib/sessao";
import { apenasDigitos, documentoValido } from "@/lib/formato";
import { PAPEL_DA_DEMONSTRACAO, ehContaDeExemplo, emailReservado } from "@/lib/demonstracao/conta";

export type EstadoFormulario = { erro?: string } | null;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Usado só para gastar o mesmo tempo quando o e-mail não existe.
const HASH_FALSO = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function criarConta(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const nome = texto(dados, "nome");
  const nomeNegocio = texto(dados, "nomeNegocio");
  const email = texto(dados, "email").toLowerCase();
  const telefone = texto(dados, "telefone");
  const documento = texto(dados, "documento");
  const cep = texto(dados, "cep");
  const endereco = texto(dados, "endereco");
  const senha = texto(dados, "senha");
  const indicadoPor = texto(dados, "indicadoPor").toLowerCase().slice(0, 40);

  if (!nome || !nomeNegocio || !email || !telefone || !documento || !senha) {
    return { erro: "Ainda falta preencher algum campo. Pode conferir, por favor?" };
  }
  if (!EMAIL_VALIDO.test(email)) {
    return { erro: "Esse e-mail parece incompleto. Pode escrevê-lo novamente?" };
  }
  if (apenasDigitos(telefone).length < 10) {
    return { erro: "O WhatsApp precisa ter DDD e número, como (66) 99251-3501." };
  }
  if (!documentoValido(documento)) {
    return {
      erro: "Esse CPF ou CNPJ não confere. Pode checar os números?",
    };
  }
  if (senha.length < 8) {
    return { erro: "Para ficar seguro, a senha precisa de pelo menos 8 caracteres." };
  }

  const jaExiste = await prisma.usuario.findUnique({ where: { email } });
  if (jaExiste || emailReservado(email)) {
    return {
      erro: "Já existe uma conta com esse e-mail. Que tal entrar em vez de criar outra?",
    };
  }

  // A primeira conta criada é a da administração, que confere os Pix recebidos.
  // O estúdio de exemplo da demonstração não conta: ele pode já existir antes.
  const primeiraConta =
    (await prisma.usuario.count({ where: { papel: { not: PAPEL_DA_DEMONSTRACAO } } })) === 0;

  // Só guarda a indicação se o código existir de verdade, para o painel não
  // mostrar parceiro que nunca existiu.
  const quemIndicou = indicadoPor
    ? await prisma.usuario.findUnique({
        where: { codigoIndicacao: indicadoPor },
        select: { codigoIndicacao: true },
      })
    : null;

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      nomeNegocio,
      email,
      telefone,
      documento: apenasDigitos(documento),
      cep: cep ? apenasDigitos(cep) : null,
      endereco: endereco || null,
      indicadoPor: quemIndicou?.codigoIndicacao ?? null,
      papel: primeiraConta ? "admin" : "dona",
      senhaHash: await bcrypt.hash(senha, 10),
      /*
        Sem teste grátis: a conta nasce na demonstração. Ela entra no painel e
        vê o estúdio de exemplo com todas as funções; quando tenta fazer algo,
        vai para a assinatura. O Pix confirmado pela administração troca o
        status para "ativa" e o painel passa a mostrar os dados dela.
      */
      assinatura: {
        // A administração (primeira conta) é a dona do Bossa: entra com tudo
        // liberado, como no `npm run seed`, para usar o painel de verdade.
        create: primeiraConta
          ? { status: "ativa", plano: "vip_anual", validaAte: new Date("2100-01-01T00:00:00.000Z") }
          : { status: "demonstracao", validaAte: new Date() },
      },
    },
  });

  await criarSessao(usuario.id, usuario.sessaoVersao);
  redirect("/painel");
}

export async function entrar(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const email = texto(dados, "email").toLowerCase();
  const senha = texto(dados, "senha");

  if (!email || !senha) {
    return { erro: "Preencha o e-mail e a senha para continuar." };
  }

  const encontrado = await prisma.usuario.findUnique({ where: { email } });
  // A conta do estúdio de exemplo não entra nunca: para o login, ela não existe.
  const usuario = encontrado && !ehContaDeExemplo(encontrado) ? encontrado : null;
  const confere = usuario
    ? await bcrypt.compare(senha, usuario.senhaHash)
    : await bcrypt.compare(senha, HASH_FALSO);

  if (!usuario || !confere) {
    return { erro: "E-mail ou senha não batem. Tenta de novo com calma?" };
  }

  await criarSessao(usuario.id, usuario.sessaoVersao);
  redirect("/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
