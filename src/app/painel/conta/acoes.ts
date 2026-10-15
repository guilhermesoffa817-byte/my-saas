"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/guardas";
import { criarSessao, encerrarSessao } from "@/lib/sessao";
import { apagar } from "@/lib/arquivos";
import {
  RECADO_DE_ESPERA_NO_PAINEL,
  chaveDoPainel,
  conferirComFreio,
} from "@/lib/limite";
import {
  conferirDadosDaConta,
  erroDaSenhaNova,
  exclusaoConfirmada,
  mudaAPortaDeEntrada,
  PALAVRA_DE_EXCLUSAO,
} from "./regras";
import { excluirEstudio } from "./exclusao";

/*
  Todas as ações daqui pedem só a sessão, e não a assinatura em dia: quem
  deixou de pagar continua podendo corrigir o próprio cadastro, trocar a senha,
  levar os dados e encerrar a conta.

  Nenhuma recebe id da tela. A conta mexida é sempre a da sessão.
*/

export type Resposta = {
  erro?: string;
  recado?: string;
  /** O que foi digitado, devolvido no erro para o formulário não voltar vazio. */
  valores?: Record<string, string>;
} | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function ehDuplicada(erro: unknown) {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    (erro as { code?: string }).code === "P2002"
  );
}

/**
 * Confere a senha atual passando pelo freio, como na tela de entrada. Sem ele,
 * quem achasse um celular com o painel aberto poderia chutar a senha aqui
 * dentro sem limite nenhum. A contagem é a do painel, separada da entrada:
 * alguém chutando senha lá fora não impede a dona de trocar a senha aqui.
 * Devolve o erro, ou null quando a senha confere.
 */
async function erroDaSenhaAtual(
  usuario: { id: string; senhaHash: string },
  senha: string,
) {
  const resultado = await conferirComFreio(prisma, chaveDoPainel(usuario.id), () =>
    bcrypt.compare(senha, usuario.senhaHash),
  );
  if (resultado === "espere") return RECADO_DE_ESPERA_NO_PAINEL;
  if (resultado === "errada") return "A senha atual não confere. Pode tentar de novo?";
  return null;
}

/* ------------------------------------------------------------------ */
/* Dados do cadastro                                                   */
/* ------------------------------------------------------------------ */

const CAMPOS = [
  "nome",
  "nomeNegocio",
  "email",
  "telefone",
  "documento",
  "cep",
  "endereco",
] as const;

export async function salvarDadosDaConta(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const usuario = await exigirUsuario();

  const digitado = Object.fromEntries(
    CAMPOS.map((campo) => [campo, texto(dados, campo)]),
  ) as Record<(typeof CAMPOS)[number], string>;
  const falhou = (erro: string): Resposta => ({ erro, valores: digitado });

  const conferido = conferirDadosDaConta(digitado);
  if (!conferido.certo) return falhou(conferido.erro);
  const valores = conferido.valores;

  if (mudaAPortaDeEntrada(usuario, valores)) {
    const senha = texto(dados, "senhaAtual");
    if (!senha) {
      return falhou(
        "Para mudar o e-mail ou o WhatsApp, digite também a sua senha atual.",
      );
    }
    const erro = await erroDaSenhaAtual(usuario, senha);
    if (erro) return falhou(erro);
  }

  const emUso = "Esse e-mail já é o de outra conta do Bossa. Use um e-mail só seu.";
  if (valores.email !== usuario.email) {
    const outra = await prisma.usuario.findFirst({
      where: { email: valores.email, NOT: { id: usuario.id } },
      select: { id: true },
    });
    if (outra) return falhou(emUso);
  }

  try {
    await prisma.usuario.update({ where: { id: usuario.id }, data: valores });
  } catch (erro) {
    // Duas contas mudando para o mesmo e-mail ao mesmo tempo: o índice único
    // do banco barra a segunda, e ela recebe o mesmo recado.
    if (ehDuplicada(erro)) return falhou(emUso);
    throw erro;
  }

  // O nome aparece no topo e no rodapé de todas as telas do painel.
  revalidatePath("/painel", "layout");
  return { recado: "Pronto, seus dados foram atualizados." };
}

/* ------------------------------------------------------------------ */
/* Senha                                                               */
/* ------------------------------------------------------------------ */

export async function trocarSenhaDaConta(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const usuario = await exigirUsuario();

  const atual = texto(dados, "senhaAtual");
  const nova = texto(dados, "senhaNova");
  const repetida = texto(dados, "repetida");

  const erro = erroDaSenhaNova({ atual, nova, repetida });
  if (erro) return { erro };

  const erroDaAtual = await erroDaSenhaAtual(usuario, atual);
  if (erroDaAtual) return { erro: erroDaAtual };

  // A versão sobe junto com a senha: todo cookie antigo passa a discordar, e
  // quem estava com a conta aberta em outro aparelho sai na próxima tela.
  const atualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await bcrypt.hash(nova, 10), sessaoVersao: { increment: 1 } },
    select: { sessaoVersao: true },
  });

  // Este aparelho ganha um cookie novo, com a versão nova, e continua dentro.
  await criarSessao(usuario.id, atualizado.sessaoVersao);

  return {
    recado:
      "Senha trocada. Se a sua conta estava aberta em outro aparelho, ela foi fechada lá. Aqui, nada muda.",
  };
}

/* ------------------------------------------------------------------ */
/* Exclusão                                                            */
/* ------------------------------------------------------------------ */

export async function excluirMinhaConta(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const usuario = await exigirUsuario();

  if (usuario.papel === "admin") {
    return {
      erro: "A conta da administração não pode ser excluída por aqui. É ela que confere os Pix das assinaturas e gera os links de senha nova.",
    };
  }

  if (!exclusaoConfirmada(texto(dados, "confirmacao"))) {
    return { erro: `Para confirmar, escreva ${PALAVRA_DE_EXCLUSAO} no campo indicado.` };
  }

  const senha = texto(dados, "senhaAtual");
  if (!senha) return { erro: "Digite a sua senha para confirmar que é você." };
  const erro = await erroDaSenhaAtual(usuario, senha);
  if (erro) return { erro };

  const resultado = await excluirEstudio(prisma, usuario.id);
  if (!resultado.excluida) {
    return {
      erro: "Não conseguimos excluir esta conta. Fale com a gente pelo WhatsApp.",
    };
  }

  /*
    Os arquivos enviados moram fora do banco e saem depois que a conta já foi
    apagada. Se o espaço de arquivos falhar agora, a conta continua excluída:
    os arquivos ficam numa pasta que ninguém mais alcança pelo Bossa, e o erro
    fica no registro do servidor para alguém apagar a pasta à mão.
  */
  try {
    for (let inicio = 0; inicio < resultado.caminhos.length; inicio += 100) {
      await apagar(resultado.caminhos.slice(inicio, inicio + 100));
    }
  } catch (falha) {
    // Só o id da pasta: o nome do arquivo pode trazer nome de cliente.
    console.error(
      `Conta excluída, mas a pasta ${usuario.id}/ não saiu do espaço de documentos.`,
      falha,
    );
  }

  await encerrarSessao();
  redirect("/");
}
