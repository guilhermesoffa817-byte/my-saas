"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { apenasDigitos, cpfValido, deDataLocal } from "@/lib/formato";
import { devolverClienteParaLista, tirarClienteDaLista } from "@/lib/historico";

export type Resposta = { erro?: string; recado?: string } | null;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/*
  Limites folgados para qualquer ficha de verdade. Existem para que um envio
  forjado não grave um texto de megabytes que depois pesa em toda tela que
  lista clientes.
*/
const LIMITES = {
  nome: 120,
  telefone: 30,
  email: 160,
  endereco: 200,
  observacoes: 2000,
};

function validar(dados: FormData) {
  const nome = texto(dados, "nome");
  const telefone = texto(dados, "telefone");
  const email = texto(dados, "email");
  const cpf = texto(dados, "cpf");
  const endereco = texto(dados, "endereco");
  const nascimento = texto(dados, "nascimento");
  const observacoes = texto(dados, "observacoes");

  if (nome.length < 2) return { erro: "Por favor, escreva o nome do cliente." } as const;
  if (nome.length > LIMITES.nome) {
    return { erro: "Esse nome ficou comprido demais. Pode encurtar?" } as const;
  }
  if (telefone.replace(/\D/g, "").length < 10 || telefone.length > LIMITES.telefone) {
    return { erro: "O telefone precisa ter DDD e número, como (66) 99251-3501." } as const;
  }
  if (
    email &&
    (email.length > LIMITES.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
  ) {
    return { erro: "Esse e-mail parece incompleto. Pode conferir?" } as const;
  }
  if (cpf && !cpfValido(cpf)) {
    return { erro: "Esse CPF não confere. Pode checar os números?" } as const;
  }
  if (endereco.length > LIMITES.endereco) {
    return { erro: "O endereço ficou comprido demais. Pode resumir?" } as const;
  }
  if (observacoes.length > LIMITES.observacoes) {
    return {
      erro: "As observações passaram de 2.000 letras. Pode resumir um pouco?",
    } as const;
  }

  const dataNascimento = nascimento ? deDataLocal(nascimento) : null;
  if (nascimento && !dataNascimento) {
    return { erro: "Não consegui entender a data de nascimento. Pode conferir?" } as const;
  }
  if (dataNascimento && dataNascimento > new Date()) {
    return { erro: "A data de nascimento ficou no futuro. Pode conferir?" } as const;
  }

  return {
    valores: {
      nome,
      telefone,
      email: email || null,
      cpf: cpf ? apenasDigitos(cpf) : null,
      endereco: endereco || null,
      nascimento: dataNascimento,
      observacoes: observacoes || null,
    },
  } as const;
}

/*
  A lista e a ficha de cada cliente moram debaixo de /painel/clientes. O
  "layout" faz a revalidação valer para a ficha também, e não só para a lista.
*/
function atualizarTelas() {
  revalidatePath("/painel/clientes", "layout");
  revalidatePath("/painel/cobrancas", "layout");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
}

export async function salvarCliente(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirAcesso();
  const conferido = validar(dados);
  if ("erro" in conferido) return { erro: conferido.erro };

  const id = texto(dados, "id");

  if (id) {
    const existente = await prisma.cliente.findFirst({
      where: { id, usuarioId: usuario.id },
    });
    if (!existente) return { erro: "Não encontramos esse cliente na sua lista." };

    await prisma.cliente.update({ where: { id }, data: conferido.valores });
    atualizarTelas();
    return { recado: `Pronto! Os dados de ${conferido.valores.nome} foram atualizados.` };
  }

  await prisma.cliente.create({
    data: { ...conferido.valores, usuarioId: usuario.id },
  });

  atualizarTelas();
  return { recado: `${conferido.valores.nome} entrou para a sua lista de clientes.` };
}

/**
 * Tira a cliente da lista.
 *
 * Quem já tem atendimento ou cobrança não é apagada de verdade: apagar levaria
 * junto, em cascata, os horários e as cobranças pagas, e o faturamento dos
 * meses passados encolheria em silêncio. Essa cliente é arquivada: sai das
 * listas e dos seletores, os horários marcados dela dali para a frente são
 * cancelados, e o histórico continua guardado e contando.
 *
 * Só a ficha sem histórico nenhum é apagada. A regra inteira mora em
 * lib/historico.ts, onde o teste de banco a exercita.
 */
export async function excluirCliente(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");
  if (!id) return;

  const resultado = await tirarClienteDaLista(prisma, {
    usuarioId: usuario.id,
    clienteId: id,
    agora: new Date(),
  });

  atualizarTelas();

  // Quem apagou de dentro da ficha não pode ficar olhando uma ficha que não
  // existe mais. O destino é fixo, nunca um endereço vindo do formulário.
  if (resultado.feito === "apagada" && texto(dados, "voltarParaLista") === "1") {
    redirect("/painel/clientes");
  }
}

/** Devolve a cliente arquivada para a lista, com o histórico do jeito que estava. */
export async function desarquivarCliente(dados: FormData) {
  const { usuario } = await exigirAcesso();
  const id = texto(dados, "id");
  if (!id) return;

  await devolverClienteParaLista(prisma, { usuarioId: usuario.id, clienteId: id });

  atualizarTelas();
}
