import "server-only";

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

export async function criarSessao(usuarioId: string) {
  const token = await new SignJWT({ sub: usuarioId })
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
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function usuarioAtual() {
  const id = await idDaSessao();
  if (!id) return null;

  return prisma.usuario.findUnique({
    where: { id },
    include: { assinatura: true },
  });
}

export type UsuarioLogado = NonNullable<Awaited<ReturnType<typeof usuarioAtual>>>;
