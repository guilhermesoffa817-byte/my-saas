/**
 * Apoio dos testes que precisam de um banco de verdade.
 *
 * Só carrega o Prisma quando há DATABASE_URL apontando para um banco de teste,
 * e recusa qualquer endereço que pareça produção. Perder dados de cliente por
 * causa de um teste seria o pior jeito de descobrir um descuido.
 */

import type { PrismaClient } from "@/generated/prisma";

export const TEM_BANCO = Boolean(process.env.DATABASE_URL);

let cliente: PrismaClient | null = null;

export async function banco(): Promise<PrismaClient> {
  if (cliente) return cliente;

  const endereco = process.env.DATABASE_URL ?? "";
  if (!endereco) throw new Error("Sem DATABASE_URL: configure .env.teste.");
  if (!/localhost|127\.0\.0\.1/.test(endereco)) {
    throw new Error(
      "O banco de teste precisa ser local. Esses testes apagam dados e nunca podem rodar contra produção.",
    );
  }

  const { PrismaClient: Prisma } = await import("@/generated/prisma");
  cliente = new Prisma({ datasources: { db: { url: endereco } } });
  return cliente;
}

/** Esvazia as tabelas, na ordem que respeita as chaves estrangeiras. */
export async function limpar() {
  const db = await banco();
  await db.lembreteDeCobranca.deleteMany();
  await db.cobranca.deleteMany();
  await db.agendamento.deleteMany();
  await db.lancamento.deleteMany();
  await db.servico.deleteMany();
  await db.cliente.deleteMany();
  await db.pagamento.deleteMany();
  await db.assinatura.deleteMany();
  await db.usuario.deleteMany();
}

/** Monta um estúdio inteiro: dona, cliente, serviço, horário e cobrança. */
export async function montarEstudio(apelido: string) {
  const db = await banco();

  const usuario = await db.usuario.create({
    data: {
      nome: `Dona ${apelido}`,
      email: `${apelido}@teste.com.br`,
      senhaHash: "x",
      nomeNegocio: `Estúdio ${apelido}`,
      pixChave: "+5566992513501",
      pixCidade: "Cuiabá",
    },
  });

  const cliente = await db.cliente.create({
    data: {
      usuarioId: usuario.id,
      nome: `Cliente de ${apelido}`,
      telefone: "66992513501",
    },
  });

  const servico = await db.servico.create({
    data: { usuarioId: usuario.id, nome: "Atendimento", precoCentavos: 12000 },
  });

  const agendamento = await db.agendamento.create({
    data: {
      usuarioId: usuario.id,
      clienteId: cliente.id,
      servicoId: servico.id,
      inicio: new Date("2026-10-05T12:00:00.000Z"),
    },
  });

  const cobranca = await db.cobranca.create({
    data: {
      usuarioId: usuario.id,
      clienteId: cliente.id,
      agendamentoId: agendamento.id,
      valorCentavos: 12000,
      vencimento: new Date("2026-10-05T00:00:00.000Z"),
    },
  });

  return { usuario, cliente, servico, agendamento, cobranca };
}
