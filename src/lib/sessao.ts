import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const NOME_COOKIE = "sessao_estudio";
const DURACAO_DIAS = 30;

function segredo() {
  const valor = process.env.SESSAO_SEGREDO;
  if (!valor || valor.length < 16) {
    throw new Error(
      "Defina SESSAO_SEGREDO no arquivo .env com pelo menos 16 caracteres.",
    );
  }
  return new TextEncoder().encode(valor);
}

export async function criarSessao(usuarioId: string, versao = 0) {
  /*
    A versão viaja dentro do cookie. Quando a senha muda, o número no banco sobe
    e todo cookie antigo passa a discordar, então quem tinha entrado com a senha
    velha é posto para fora. Sem isso, trocar a senha não expulsaria ninguém.
  */
  const token = await new SignJWT({ sub: usuarioId, v: versao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(segredo());

  const armario = await cookies();
  armario.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao() {
  const armario = await cookies();
  armario.delete(NOME_COOKIE);
}

async function idDaSessao() {
  const armario = await cookies();
  const token = armario.get(NOME_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo());
    if (typeof payload.sub !== "string") return null;
    // Cookie emitido antes desta mudança não traz versão: vale como zero, que
    // é o padrão de quem nunca trocou a senha. Ninguém é desconectado à toa.
    const versao = typeof payload.v === "number" ? payload.v : 0;
    return { id: payload.sub, versao };
  } catch {
    return null;
  }
}

/**
 * `cache` guarda o resultado durante a montagem de uma página: o contorno e a
 * página pedem o usuário, e o banco é consultado uma vez só. Cada consulta
 * evitada economiza uma viagem de ida e volta até São Paulo.
 */
const buscarUsuario = cache(async (id: string) =>
  prisma.usuario.findUnique({
    where: { id },
    include: { assinatura: true },
  }),
);

export async function usuarioAtual() {
  const sessao = await idDaSessao();
  if (!sessao) return null;

  const usuario = await buscarUsuario(sessao.id);
  if (!usuario) return null;

  // Senha trocada depois deste cookie: a sessão não vale mais.
  if (usuario.sessaoVersao !== sessao.versao) return null;

  return usuario;
}

export type UsuarioLogado = NonNullable<Awaited<ReturnType<typeof usuarioAtual>>>;
