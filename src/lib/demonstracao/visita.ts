import "server-only";

import { cookies } from "next/headers";

/**
 * A visita sem cadastro: quem chega pela página de vendas pode abrir o estúdio
 * de exemplo sem criar conta, só para olhar.
 *
 * O cookie diz apenas "esta pessoa quer ver o exemplo". Ele não dá acesso a
 * conta nenhuma: as telas mostram o estúdio de exemplo (que é o mesmo para
 * todo mundo e só tem dado inventado) e toda ação que grava pede a conta da
 * sessão, que o visitante não tem. Por isso não precisa ser assinado.
 */
const NOME_COOKIE = "visita_demonstracao";
const DURACAO_DIAS = 7;

/** Se quem está no navegador abriu a visita sem cadastro. */
export async function ehVisitante() {
  const armario = await cookies();
  return armario.get(NOME_COOKIE)?.value === "1";
}

/** Só funciona numa rota ou numa ação: as telas não gravam cookie. */
export async function abrirVisita() {
  const armario = await cookies();
  armario.set(NOME_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function fecharVisita() {
  const armario = await cookies();
  armario.delete(NOME_COOKIE);
}
