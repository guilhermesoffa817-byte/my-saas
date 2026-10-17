import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { usuarioAtual, type UsuarioLogado } from "@/lib/sessao";
import { avaliarAssinatura, type SituacaoAssinatura } from "@/lib/assinatura";
import { podeUsar, type Recurso } from "@/lib/recursos";
import { DESTINO_DA_DEMONSTRACAO, ehContaDeExemplo } from "@/lib/demonstracao/conta";
import { estudioDeExemplo } from "@/lib/demonstracao/estudio";

/*
  Dois tipos de porta, e a diferença entre elas é a regra mais importante da
  demonstração:

  - LEITURA (exigirLeitura, exigirLeituraDoRecurso): para as telas. Durante a
    demonstração, devolvem a conta do estúdio de exemplo como dona dos dados,
    com todas as funções liberadas. A pessoa navega, abre abas, troca de mês.

  - ESCRITA (exigirEscrita, exigirEscritaDoRecurso, exigirEscritaNaApi): para as
    ações ("use server") e as rotas de API que gravam ou gastam IA. Durante a
    demonstração, mandam para a assinatura. E SEMPRE devolvem a conta da sessão,
    nunca a de exemplo: o estúdio de exemplo é compartilhado por todo mundo e
    nenhum visitante pode mudar nada nele.

  Um teste (src/testes/guardas-das-acoes.teste.ts) varre os arquivos "use
  server" e as rotas de API e falha se algum usar uma porta de leitura.
*/

export type Leitura = {
  /** O dono dos dados da tela: a própria conta, ou o estúdio de exemplo na demonstração. */
  usuario: UsuarioLogado;
  situacao: SituacaoAssinatura;
  /** Na demonstração as telas pulam faxinas que gravariam no estúdio de exemplo. */
  demonstracao: boolean;
};

export type Escrita = {
  /** Sempre a conta da sessão. */
  usuario: UsuarioLogado;
  situacao: SituacaoAssinatura;
};

/** Também guardado durante a montagem: contorno e página perguntam o mesmo. */
const pixAvisado = cache(async (usuarioId: string) =>
  prisma.pagamento.findFirst({
    where: { usuarioId, status: "aguardando" },
    select: { id: true },
  }),
);

/** Uma vez por pedido: o contorno e a página pedem o estúdio de exemplo juntos. */
const estudioDoPedido = cache(() => estudioDeExemplo(prisma));

export async function exigirUsuario(): Promise<UsuarioLogado> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return usuario;
}

/**
 * Situação da assinatura já considerando um Pix avisado e ainda não conferido:
 * nesse caso o recado é de espera, e não de cobrança. Na demonstração, a pessoa
 * continua vendo o exemplo até o Pix ser confirmado.
 */
export async function situacaoDoUsuario(
  usuario: UsuarioLogado,
): Promise<SituacaoAssinatura> {
  const situacao = avaliarAssinatura(usuario.assinatura);
  if (situacao.liberada) return situacao;

  const pendente = await pixAvisado(usuario.id);
  if (!pendente) return situacao;

  return {
    ...situacao,
    status: "aguardando",
    recado:
      "Recebemos o aviso do seu Pix. Assim que confirmarmos o pagamento, seu painel volta a abrir. Costuma ser rápido.",
  };
}

/* ------------------------------------------------------------- leitura */

/** Porta das telas do painel. Na demonstração, os dados são do estúdio de exemplo. */
export async function exigirLeitura(): Promise<Leitura> {
  const conta = await exigirUsuario();
  const situacao = await situacaoDoUsuario(conta);

  if (situacao.demonstracao) {
    const exemplo = await estudioDoPedido();
    return { usuario: exemplo, situacao, demonstracao: true };
  }

  if (!situacao.liberada) redirect("/painel/assinatura");
  return { usuario: conta, situacao, demonstracao: false };
}

/**
 * Porta das telas que dependem de plano. A regra de quem pode o quê está em
 * lib/recursos.ts; aqui só se aplica o resultado. Quem não tem o plano vai para
 * a tela de assinatura. Na demonstração tudo abre (o exemplo é Completo).
 */
export async function exigirLeituraDoRecurso(recurso: Recurso): Promise<Leitura> {
  const leitura = await exigirLeitura();
  if (!podeUsar(leitura.usuario, recurso)) redirect("/painel/assinatura?completo=1");
  return leitura;
}

/* ------------------------------------------------------------- escrita */

/**
 * Porta das ações que gravam. Devolve SEMPRE a conta da sessão. Na
 * demonstração, ou com a assinatura vencida, a ação nem começa: vai para a
 * tela de assinatura.
 */
export async function exigirEscrita(): Promise<Escrita> {
  const usuario = await exigirUsuario();
  // Defesa a mais: a sessão já recusa a conta de exemplo (lib/sessao.ts).
  if (ehContaDeExemplo(usuario)) redirect(DESTINO_DA_DEMONSTRACAO);

  const situacao = await situacaoDoUsuario(usuario);
  if (situacao.demonstracao) redirect(DESTINO_DA_DEMONSTRACAO);
  if (!situacao.liberada) redirect("/painel/assinatura");
  return { usuario, situacao };
}

export async function exigirEscritaDoRecurso(recurso: Recurso): Promise<Escrita> {
  const escrita = await exigirEscrita();
  if (!podeUsar(escrita.usuario, recurso)) redirect("/painel/assinatura?completo=1");
  return escrita;
}

/**
 * Para o pouco que a pessoa pode fazer com os próprios dados mesmo sem
 * assinatura em dia (apagar uma conversa do assistente, por privacidade). Na
 * demonstração vai para a assinatura como as outras: lá não há dado próprio.
 */
export async function exigirContaPropria(): Promise<Escrita> {
  const usuario = await exigirUsuario();
  if (ehContaDeExemplo(usuario)) redirect(DESTINO_DA_DEMONSTRACAO);
  const situacao = await situacaoDoUsuario(usuario);
  if (situacao.demonstracao) redirect(DESTINO_DA_DEMONSTRACAO);
  return { usuario, situacao };
}

/**
 * A mesma porta de escrita, para as rotas de API: em vez de redirecionar,
 * responde com o status e um `destino` que a tela usa para levar a pessoa à
 * assinatura. `codigo` diz o motivo ("demonstracao", "assinatura", "plano").
 */
export async function exigirEscritaNaApi(
  recurso: Recurso,
): Promise<{ usuario: UsuarioLogado; resposta?: undefined } | { usuario?: undefined; resposta: Response }> {
  const recusar = (status: number, erro: string, codigo: string, destino?: string) => ({
    resposta: Response.json({ erro, codigo, ...(destino ? { destino } : {}) }, { status }),
  });

  const usuario = await usuarioAtual();
  if (!usuario || ehContaDeExemplo(usuario)) {
    return recusar(401, "Entre na sua conta para continuar.", "sessao", "/entrar");
  }

  const situacao = await situacaoDoUsuario(usuario);
  if (situacao.demonstracao) {
    return recusar(
      403,
      "Para fazer isso com os seus clientes, escolha um plano.",
      "demonstracao",
      DESTINO_DA_DEMONSTRACAO,
    );
  }
  if (!situacao.liberada) {
    return recusar(403, "Sua assinatura venceu. Renove para continuar.", "assinatura", "/painel/assinatura");
  }
  if (!podeUsar(usuario, recurso)) {
    return recusar(403, "Isso faz parte do plano Completo.", "plano", "/painel/assinatura?completo=1");
  }
  return { usuario };
}

/* --------------------------------------------------------------- admin */

export async function exigirAdmin(): Promise<UsuarioLogado> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "admin") redirect("/painel");
  return usuario;
}
