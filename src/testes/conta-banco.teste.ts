import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import {
  RECADO_DE_ESPERA,
  RECADO_DE_SENHA_ERRADA,
  chaveDoEmail,
  chaveDoPainel,
  conferirComFreio,
  conferirEntrada,
} from "@/lib/limite";
import { planilhaEmCsv } from "@/app/api/exportar/planilhas";
import { excluirEstudio } from "@/app/painel/conta/exclusao";

const SENHA = "senha-certa-123";
const agora = new Date("2026-10-14T15:00:00.000Z");
const minutos = (n: number) => new Date(agora.getTime() + n * 60 * 1000);

/** Uma conta com senha de verdade. Custo baixo no bcrypt só para o teste andar. */
async function contaComSenha(email: string) {
  const db = await banco();
  return db.usuario.create({
    data: {
      nome: "Ana",
      email,
      senhaHash: await bcrypt.hash(SENHA, 4),
      nomeNegocio: "Estúdio Ana",
    },
  });
}

/**
 * O freio da senha, contra o Postgres.
 *
 * Roda a mesma conferência que a tela de entrada chama. O que não pode
 * acontecer: a nona tentativa passar, o freio valer só para e-mail cadastrado
 * (o que revelaria quem tem conta) ou acertar a senha não zerar a contagem.
 */
describe.skipIf(!TEM_BANCO)("freio da tela de entrada", () => {
  beforeEach(async () => {
    await limpar();
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("a nona tentativa espera, mesmo com a senha certa", async () => {
    const db = await banco();
    await contaComSenha("ana@teste.com.br");

    for (let vez = 0; vez < 8; vez++) {
      const errada = await conferirEntrada(db, "ana@teste.com.br", "chute", minutos(vez));
      expect(errada).toEqual({ certo: false, erro: RECADO_DE_SENHA_ERRADA });
    }

    const nona = await conferirEntrada(db, "ana@teste.com.br", SENHA, minutos(8));
    expect(nona).toEqual({ certo: false, erro: RECADO_DE_ESPERA });

    // A tentativa barrada não conta como erro novo.
    expect(
      await db.tentativaDeEntrada.count({
        where: { chave: chaveDoEmail("ana@teste.com.br") },
      }),
    ).toBe(8);
  });

  it("passada a janela, a senha certa volta a entrar", async () => {
    const db = await banco();
    const conta = await contaComSenha("ana@teste.com.br");

    for (let vez = 0; vez < 8; vez++) {
      await conferirEntrada(db, "ana@teste.com.br", "chute", agora);
    }
    const depois = await conferirEntrada(db, "ana@teste.com.br", SENHA, minutos(16));
    expect(depois).toEqual({
      certo: true,
      usuario: { id: conta.id, sessaoVersao: conta.sessaoVersao },
    });
  });

  it("acertar a senha zera a contagem daquele e-mail", async () => {
    const db = await banco();
    await contaComSenha("ana@teste.com.br");

    for (let vez = 0; vez < 7; vez++) {
      await conferirEntrada(db, "ana@teste.com.br", "chute", agora);
    }
    expect((await conferirEntrada(db, "ana@teste.com.br", SENHA, agora)).certo).toBe(
      true,
    );
    expect(
      await db.tentativaDeEntrada.count({
        where: { chave: chaveDoEmail("ana@teste.com.br") },
      }),
    ).toBe(0);

    // Zerado, cabem de novo oito erros antes de esperar.
    for (let vez = 0; vez < 7; vez++) {
      await conferirEntrada(db, "ana@teste.com.br", "chute", agora);
    }
    expect((await conferirEntrada(db, "ana@teste.com.br", SENHA, agora)).certo).toBe(
      true,
    );
  });

  it("e-mail que não existe recebe o mesmo freio e os mesmos recados", async () => {
    const db = await banco();

    for (let vez = 0; vez < 8; vez++) {
      const errada = await conferirEntrada(db, "ninguem@teste.com.br", SENHA, agora);
      expect(errada).toEqual({ certo: false, erro: RECADO_DE_SENHA_ERRADA });
    }
    expect(await conferirEntrada(db, "ninguem@teste.com.br", SENHA, agora)).toEqual({
      certo: false,
      erro: RECADO_DE_ESPERA,
    });
  });

  it("maiúsculas no e-mail contam como o mesmo e-mail", async () => {
    const db = await banco();
    await contaComSenha("ana@teste.com.br");

    for (let vez = 0; vez < 8; vez++) {
      await conferirEntrada(
        db,
        vez % 2 ? "ANA@teste.com.br" : " Ana@Teste.com.br ",
        "chute",
        agora,
      );
    }
    expect((await conferirEntrada(db, "ana@teste.com.br", SENHA, agora)).certo).toBe(
      false,
    );
  });

  it("travar um e-mail não trava a conta de outra pessoa", async () => {
    const db = await banco();
    await contaComSenha("ana@teste.com.br");
    await contaComSenha("bia@teste.com.br");

    for (let vez = 0; vez < 8; vez++) {
      await conferirEntrada(db, "ana@teste.com.br", "chute", agora);
    }
    expect((await conferirEntrada(db, "bia@teste.com.br", SENHA, agora)).certo).toBe(
      true,
    );
  });

  it("quem chuta senha na entrada não trava a dona dentro do painel", async () => {
    const db = await banco();
    const conta = await contaComSenha("ana@teste.com.br");

    for (let vez = 0; vez < 8; vez++) {
      await conferirEntrada(db, "ana@teste.com.br", "chute", agora);
    }
    // A troca de senha, lá dentro, confere pela chave do painel.
    const dentro = await conferirComFreio(
      db,
      chaveDoPainel(conta.id),
      () => bcrypt.compare(SENHA, conta.senhaHash),
      agora,
    );
    expect(dentro).toBe("confere");

    // E o freio do painel existe por conta própria.
    for (let vez = 0; vez < 8; vez++) {
      await conferirComFreio(db, chaveDoPainel(conta.id), async () => false, agora);
    }
    expect(
      await conferirComFreio(db, chaveDoPainel(conta.id), async () => true, agora),
    ).toBe("espere");
  });

  it("errar leva junto as tentativas com mais de um dia", async () => {
    const db = await banco();
    await db.tentativaDeEntrada.create({
      data: { chave: chaveDoEmail("antiga@teste.com.br"), criadoEm: minutos(-25 * 60) },
    });

    await conferirEntrada(db, "ana@teste.com.br", "chute", agora);

    const sobraram = await db.tentativaDeEntrada.findMany({ select: { chave: true } });
    expect(sobraram).toEqual([{ chave: chaveDoEmail("ana@teste.com.br") }]);
  });
});

/**
 * Baixar meus dados.
 *
 * A planilha sai do estúdio da sessão e de mais nenhum. As clientes arquivadas
 * entram, porque a cópia dos dados é completa.
 */
describe.skipIf(!TEM_BANCO)("planilhas de Baixar meus dados", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("um");
    outro = await montarEstudio("outro");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("a planilha de clientes traz só as do estúdio, inclusive as arquivadas", async () => {
    const db = await banco();
    await db.cliente.create({
      data: {
        usuarioId: um.usuario.id,
        nome: "Arquivada de um",
        telefone: "66990000000",
        arquivadoEm: new Date("2026-10-01T15:00:00.000Z"),
      },
    });

    const csv = await planilhaEmCsv(db, um.usuario.id, "clientes", agora);

    expect(csv.startsWith("﻿Nome;WhatsApp;")).toBe(true);
    expect(csv).toContain("Cliente de um;");
    expect(csv).toContain("Arquivada de um;");
    expect(csv).toContain("01/10/2026");
    expect(csv).not.toContain("Cliente de outro");
    // Cabeçalho, duas clientes e a linha vazia depois do último CRLF.
    expect(csv.split("\r\n")).toHaveLength(4);
  });

  it("nenhuma planilha traz dado do outro estúdio", async () => {
    const db = await banco();
    await db.lancamento.create({
      data: {
        usuarioId: outro.usuario.id,
        tipo: "saida",
        descricao: "Aluguel do outro",
        valorCentavos: 90000,
        data: agora,
      },
    });
    await db.vencimento.create({
      data: {
        usuarioId: outro.usuario.id,
        descricao: "Luz do outro",
        valorCentavos: 15000,
        data: new Date("2026-10-20T00:00:00.000Z"),
      },
    });

    for (const tipo of [
      "clientes",
      "atendimentos",
      "cobrancas",
      "lancamentos",
      "vencimentos",
    ] as const) {
      const csv = await planilhaEmCsv(db, um.usuario.id, tipo, agora);
      expect(csv, tipo).not.toContain("outro");
    }

    const doOutro = await planilhaEmCsv(db, outro.usuario.id, "vencimentos", agora);
    expect(doOutro).toContain("20/10/2026;Conta;Luz do outro;;150,00;A pagar;");
  });

  it("o atendimento vale o preço combinado, não o preço de hoje do serviço", async () => {
    const db = await banco();
    await db.agendamento.update({
      where: { id: um.agendamento.id },
      data: { valorCentavos: 9000, status: "concluido" },
    });
    // O serviço subiu de preço depois do atendimento.
    await db.servico.update({
      where: { id: um.servico.id },
      data: { precoCentavos: 15000 },
    });

    const csv = await planilhaEmCsv(db, um.usuario.id, "atendimentos", agora);
    expect(csv).toContain(";Cliente de um;Atendimento;90,00;Concluído;");
  });

  it("horário antigo, sem valor guardado, cai no preço do serviço", async () => {
    const db = await banco();
    const csv = await planilhaEmCsv(db, um.usuario.id, "atendimentos", agora);
    expect(csv).toContain(";Cliente de um;Atendimento;120,00;Agendado;");
  });

  it("a cobrança vencida e não paga sai como atrasada", async () => {
    const db = await banco();
    const csv = await planilhaEmCsv(db, um.usuario.id, "cobrancas", agora);
    expect(csv).toContain("Cliente de um;120,00;05/10/2026;Atrasada;");
  });
});

/**
 * Excluir minha conta.
 *
 * A conta sai com tudo o que é dela, e só ela: o estúdio vizinho fica inteiro.
 * A conta da administração nunca sai por aqui.
 */
describe.skipIf(!TEM_BANCO)("exclusão da conta", () => {
  beforeEach(async () => {
    await limpar();
  });

  afterAll(async () => {
    const db = await banco();
    await db.documento.deleteMany();
    await limpar();
    await db.$disconnect();
  });

  it("apaga a conta com tudo dentro e devolve os arquivos para apagar", async () => {
    const db = await banco();
    const sai = await montarEstudio("sai");
    const fica = await montarEstudio("fica");
    await db.documento.create({
      data: {
        usuarioId: sai.usuario.id,
        nome: "Contrato.pdf",
        caminho: `${sai.usuario.id}/doc/Contrato.pdf`,
        tipoDoArquivo: "application/pdf",
        tamanhoBytes: 1000,
      },
    });
    await db.tentativaDeEntrada.createMany({
      data: [
        { chave: chaveDoEmail(sai.usuario.email), criadoEm: agora },
        { chave: chaveDoPainel(sai.usuario.id), criadoEm: agora },
        { chave: chaveDoEmail(fica.usuario.email), criadoEm: agora },
      ],
    });

    const resultado = await excluirEstudio(db, sai.usuario.id);

    expect(resultado).toEqual({
      excluida: true,
      caminhos: [`${sai.usuario.id}/doc/Contrato.pdf`],
    });
    expect(await db.usuario.findUnique({ where: { id: sai.usuario.id } })).toBeNull();
    for (const sobra of [
      await db.cliente.count({ where: { usuarioId: sai.usuario.id } }),
      await db.servico.count({ where: { usuarioId: sai.usuario.id } }),
      await db.agendamento.count({ where: { usuarioId: sai.usuario.id } }),
      await db.cobranca.count({ where: { usuarioId: sai.usuario.id } }),
      await db.documento.count({ where: { usuarioId: sai.usuario.id } }),
      await db.tentativaDeEntrada.count({
        where: {
          chave: { in: [chaveDoEmail(sai.usuario.email), chaveDoPainel(sai.usuario.id)] },
        },
      }),
    ]) {
      expect(sobra).toBe(0);
    }

    // O vizinho continua com tudo.
    expect(
      await db.usuario.findUnique({ where: { id: fica.usuario.id } }),
    ).not.toBeNull();
    expect(await db.cobranca.count({ where: { usuarioId: fica.usuario.id } })).toBe(1);
    expect(await db.agendamento.count({ where: { usuarioId: fica.usuario.id } })).toBe(1);
    expect(
      await db.tentativaDeEntrada.count({
        where: { chave: chaveDoEmail(fica.usuario.email) },
      }),
    ).toBe(1);
  });

  it("a conta da administração não sai", async () => {
    const db = await banco();
    const admin = await montarEstudio("admin");
    await db.usuario.update({
      where: { id: admin.usuario.id },
      data: { papel: "admin" },
    });

    expect(await excluirEstudio(db, admin.usuario.id)).toEqual({ excluida: false });
    expect(
      await db.usuario.findUnique({ where: { id: admin.usuario.id } }),
    ).not.toBeNull();
    expect(await db.cliente.count({ where: { usuarioId: admin.usuario.id } })).toBe(1);
  });

  it("conta que não existe não apaga nada", async () => {
    const db = await banco();
    await montarEstudio("fica");
    expect(await excluirEstudio(db, "conta-que-nao-existe")).toEqual({ excluida: false });
    expect(await db.usuario.count()).toBe(1);
  });
});
