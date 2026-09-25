"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarSessao, encerrarSessao } from "@/lib/sessao";
import { DIAS_DE_TESTE } from "@/lib/assinatura";
import { apenasDigitos, documentoValido, somarDias } from "@/lib/formato";

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

  if (!nome || !nomeNegocio || !email || !telefone || !documento || !senha) {
    return { erro: "Faltou preencher algum campo. Dá uma conferida, por favor?" };
  }
  if (!EMAIL_VALIDO.test(email)) {
    return { erro: "Esse e-mail parece incompleto. Pode escrever de novo?" };
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
  if (jaExiste) {
    return {
      erro: "Já existe uma conta com esse e-mail. Que tal entrar por aqui?",
    };
  }

  // A primeira conta criada é a da administração, que confere os Pix recebidos.
  const primeiraConta = (await prisma.usuario.count()) === 0;

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      nomeNegocio,
      email,
      telefone,
      documento: apenasDigitos(documento),
      cep: cep ? apenasDigitos(cep) : null,
      endereco: endereco || null,
      papel: primeiraConta ? "admin" : "dona",
      senhaHash: await bcrypt.hash(senha, 10),
      assinatura: {
        create: {
          status: "teste",
          validaAte: somarDias(new Date(), DIAS_DE_TESTE),
        },
      },
    },
  });

  await criarSessao(usuario.id);
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

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const confere = usuario
    ? await bcrypt.compare(senha, usuario.senhaHash)
    : await bcrypt.compare(senha, HASH_FALSO);

  if (!usuario || !confere) {
    return { erro: "E-mail ou senha não batem. Tenta de novo com calma?" };
  }

  await criarSessao(usuario.id);
  redirect("/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
