"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirEscritaDoRecurso } from "@/lib/guardas";
import { hojeNoEstudio, paraDataPura } from "@/lib/formato";
import {
  desligarColaborador,
  excluirAusencia,
  excluirPagamento,
  lerAusencia,
  lerColaborador,
  lerPagamento,
  registrarAusencia,
  registrarPagamento,
  removerColaborador,
  salvarColaborador,
} from "@/lib/equipe-operacoes";

/**
 * `campos` devolve o que a pessoa digitou quando algo dá errado. O React limpa
 * o formulário depois de cada envio; sem isso, um CPF errado apagaria o
 * cadastro inteiro que ela acabou de preencher.
 */
export type Resposta = {
  erro?: string;
  recado?: string;
  campos?: Record<string, string>;
} | null;

function leitor(dados: FormData) {
  return (campo: string) => {
    const valor = dados.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };
}

function devolverCampos(dados: FormData) {
  const campos: Record<string, string> = {};
  for (const [chave, valor] of dados.entries()) {
    if (typeof valor === "string" && !chave.startsWith("$")) campos[chave] = valor;
  }
  return campos;
}

function atualizarTelas({ financas = false, agenda = false } = {}) {
  revalidatePath("/painel/equipe");
  if (financas) {
    revalidatePath("/painel/financas");
    revalidatePath("/painel");
  }
  if (agenda) revalidatePath("/painel/agenda");
}

function hoje() {
  return paraDataPura(hojeNoEstudio());
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export async function salvarColaboradorAcao(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("equipe");

  const entrada = lerColaborador(leitor(dados));
  if ("erro" in entrada) return { erro: entrada.erro, campos: devolverCampos(dados) };

  const salvo = await salvarColaborador(prisma, usuario.id, entrada);
  if ("erro" in salvo) return { erro: salvo.erro, campos: devolverCampos(dados) };

  atualizarTelas({ agenda: true });
  // Na edição, volta para a lista: o formulário de edição sai da tela.
  if (!salvo.novo) redirect("/painel/equipe?aviso=atualizado");
  return { recado: `${entrada.nome} entrou na sua equipe.` };
}

export async function desligarColaboradorAcao(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("equipe");
  const ler = leitor(dados);

  const resultado = await desligarColaborador(prisma, usuario.id, ler("id"), ler("fim"));
  if ("erro" in resultado) return { erro: resultado.erro };

  atualizarTelas({ agenda: true });
  return { recado: "Desligamento registrado." };
}

export async function removerColaboradorAcao(dados: FormData) {
  const { usuario } = await exigirEscritaDoRecurso("equipe");
  const resultado = await removerColaborador(prisma, usuario.id, leitor(dados)("id"), hoje());
  if ("erro" in resultado) redirect("/painel/equipe?aviso=nao-encontrado");

  atualizarTelas({ agenda: true, financas: resultado.resultado === "anonimizado" });
  redirect(`/painel/equipe?aviso=${resultado.resultado}`);
}

// ---------------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------------

export async function registrarAusenciaAcao(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("equipe");

  const entrada = lerAusencia(leitor(dados));
  if ("erro" in entrada) return { erro: entrada.erro, campos: devolverCampos(dados) };

  const criada = await registrarAusencia(prisma, usuario.id, entrada);
  if ("erro" in criada) return { erro: criada.erro, campos: devolverCampos(dados) };

  atualizarTelas({ agenda: true });
  return { recado: "Ausência registrada." };
}

export async function excluirAusenciaAcao(dados: FormData) {
  const { usuario } = await exigirEscritaDoRecurso("equipe");
  await excluirAusencia(prisma, usuario.id, leitor(dados)("id"));
  atualizarTelas({ agenda: true });
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export async function registrarPagamentoAcao(
  _anterior: Resposta,
  dados: FormData,
): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("equipe");

  const entrada = lerPagamento(leitor(dados));
  if ("erro" in entrada) return { erro: entrada.erro, campos: devolverCampos(dados) };

  const criado = await registrarPagamento(prisma, usuario.id, entrada);
  if ("erro" in criado) return { erro: criado.erro, campos: devolverCampos(dados) };

  atualizarTelas({ financas: true });
  return { recado: "Pagamento registrado. A saída já entrou nas suas Finanças." };
}

export async function excluirPagamentoAcao(dados: FormData) {
  const { usuario } = await exigirEscritaDoRecurso("equipe");
  const apagado = await excluirPagamento(prisma, usuario.id, leitor(dados)("id"));
  // Mês fechado: o pagamento fica, e o recado vai no endereço da própria aba.
  if (typeof apagado === "object") {
    redirect(`/painel/equipe?aba=pagamentos&mes=${apagado.competencia}&aviso=mes-fechado`);
  }
  atualizarTelas({ financas: true });
}
