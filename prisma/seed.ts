import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function somarDias(data: Date, dias: number) {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000);
}

function hojeAs(hora: number, minuto = 0, diasAFrente = 0) {
  const dia = somarDias(new Date(), diasAFrente).toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return new Date(`${dia}T${doisDigitos(hora)}:${doisDigitos(minuto)}:00-03:00`);
}

async function main() {
  const emailAdmin = (process.env.ADMIN_EMAIL ?? "admin@meuestudio.com.br").toLowerCase();
  const senhaAdmin = process.env.ADMIN_SENHA ?? "mudeessasenha123";

  const admin = await prisma.usuario.upsert({
    where: { email: emailAdmin },
    update: { papel: "admin" },
    create: {
      nome: "Administração",
      nomeNegocio: "Agenda Online",
      email: emailAdmin,
      senhaHash: await bcrypt.hash(senhaAdmin, 10),
      papel: "admin",
      assinatura: {
        create: { status: "ativa", validaAte: somarDias(new Date(), 3650) },
      },
    },
  });

  const demo = await prisma.usuario.upsert({
    where: { email: "demo@meuestudio.com.br" },
    update: {},
    create: {
      nome: "Ana Paula Rocha",
      nomeNegocio: "Estúdio Bela Pele",
      email: "demo@meuestudio.com.br",
      telefone: "66992513501",
      senhaHash: await bcrypt.hash("demo12345", 10),
      assinatura: {
        create: { status: "ativa", validaAte: somarDias(new Date(), 30) },
      },
    },
  });

  const jaTemDados = await prisma.cliente.count({ where: { usuarioId: demo.id } });
  if (jaTemDados === 0) {
    const [marina, bianca, tereza] = await Promise.all([
      prisma.cliente.create({
        data: {
          usuarioId: demo.id,
          nome: "Marina Alves",
          telefone: "11988887777",
          email: "marina@email.com",
          observacoes: "Pele sensível, prefere produtos sem perfume.",
        },
      }),
      prisma.cliente.create({
        data: {
          usuarioId: demo.id,
          nome: "Bianca Rocha",
          telefone: "11977776666",
          observacoes: "Gosta de horários no fim da tarde.",
        },
      }),
      prisma.cliente.create({
        data: {
          usuarioId: demo.id,
          nome: "Tereza Lima",
          telefone: "11966665555",
        },
      }),
    ]);

    const [limpeza, design, massagem] = await Promise.all([
      prisma.servico.create({
        data: {
          usuarioId: demo.id,
          nome: "Limpeza de pele profunda",
          precoCentavos: 18000,
          duracaoMin: 90,
          descricao: "Higienização, extração e máscara calmante.",
        },
      }),
      prisma.servico.create({
        data: {
          usuarioId: demo.id,
          nome: "Design de sobrancelha",
          precoCentavos: 6000,
          duracaoMin: 40,
        },
      }),
      prisma.servico.create({
        data: {
          usuarioId: demo.id,
          nome: "Massagem relaxante",
          precoCentavos: 15000,
          duracaoMin: 60,
        },
      }),
    ]);

    await prisma.agendamento.createMany({
      data: [
        {
          usuarioId: demo.id,
          clienteId: marina.id,
          servicoId: limpeza.id,
          inicio: hojeAs(9),
          status: "agendado",
        },
        {
          usuarioId: demo.id,
          clienteId: bianca.id,
          servicoId: design.id,
          inicio: hojeAs(11, 30),
          status: "agendado",
        },
        {
          usuarioId: demo.id,
          clienteId: tereza.id,
          servicoId: massagem.id,
          inicio: hojeAs(14),
          status: "agendado",
        },
        {
          usuarioId: demo.id,
          clienteId: marina.id,
          servicoId: design.id,
          inicio: hojeAs(10, 0, -3),
          status: "concluido",
        },
        {
          usuarioId: demo.id,
          clienteId: tereza.id,
          servicoId: limpeza.id,
          inicio: hojeAs(15, 0, -5),
          status: "concluido",
        },
      ],
    });
  }

  console.log("Pronto!");
  console.log(`Administração: ${admin.email} / ${senhaAdmin}`);
  console.log(`Estúdio de demonstração: ${demo.email} / demo12345`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
