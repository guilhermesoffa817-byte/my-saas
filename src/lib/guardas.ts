import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { usuarioAtual, type UsuarioLogado } from "@/lib/sessao";
import { avaliarAssinatura, type SituacaoAssinatura } from "@/lib/assinatura";

export async function exigirUsuario(): Promise<UsuarioLogado> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return usuario;
}

/**
 * Situação da assinatura já considerando um Pix avisado e ainda não conferido:
 * nesse caso o recado é de espera, e não de cobrança.
 */
export async function situacaoDoUsuario(
  usuario: UsuarioLogado,
): Promise<SituacaoAssinatura> {
  const situacao = avaliarAssinatura(usuario.assinatura);
  if (situacao.liberada) return situacao;

  const pendente = await prisma.pagamento.findFirst({
    where: { usuarioId: usuario.id, status: "aguardando" },
  });
  if (!pendente) return situacao;

  return {
    ...situacao,
    status: "aguardando",
    recado:
      "Recebemos o aviso do seu Pix. Assim que confirmarmos o pagamento, seu painel volta a abrir — costuma ser rapidinho.",
  };
}

export async function exigirAcesso(): Promise<{
  usuario: UsuarioLogado;
  situacao: SituacaoAssinatura;
}> {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);
  if (!situacao.liberada) redirect("/painel/assinatura");
  return { usuario, situacao };
}

export async function exigirAdmin(): Promise<UsuarioLogado> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "admin") redirect("/painel");
  return usuario;
}
