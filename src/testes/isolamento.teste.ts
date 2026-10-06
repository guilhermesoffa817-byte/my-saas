import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";

/**
 * Separação entre estúdios.
 *
 * Todas as telas e ações buscam filtrando pelo estúdio da sessão. Estes testes
 * repetem exatamente essa forma de consulta, com o id do estúdio errado, e
 * exigem que não venha nada. Se um dia alguém tirar o `usuarioId` de um `where`,
 * é aqui que o descuido aparece, antes de virar vazamento de dado de cliente.
 */
describe.skipIf(!TEM_BANCO)("um estúdio não enxerga o outro", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;

  beforeAll(async () => {
    await limpar();
    um = await montarEstudio("um");
    outro = await montarEstudio("outro");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("não acha a cobrança do outro estúdio", async () => {
    const db = await banco();

    // A consulta da tela da cobrança, com o estúdio errado.
    const invadindo = await db.cobranca.findFirst({
      where: { id: outro.cobranca.id, usuarioId: um.usuario.id },
    });
    expect(invadindo).toBeNull();

    // E, com o estúdio certo, acha.
    const legitima = await db.cobranca.findFirst({
      where: { id: outro.cobranca.id, usuarioId: outro.usuario.id },
    });
    expect(legitima?.id).toBe(outro.cobranca.id);
  });

  it("não marca como paga a cobrança do outro estúdio", async () => {
    const db = await banco();

    const mudadas = await db.cobranca.updateMany({
      where: { id: outro.cobranca.id, usuarioId: um.usuario.id, situacao: "aberta" },
      data: { situacao: "paga" },
    });
    expect(mudadas.count).toBe(0);

    const intacta = await db.cobranca.findUnique({ where: { id: outro.cobranca.id } });
    expect(intacta?.situacao).toBe("aberta");
  });

  it("não cancela a cobrança do outro estúdio", async () => {
    const db = await banco();
    const mudadas = await db.cobranca.updateMany({
      where: { id: outro.cobranca.id, usuarioId: um.usuario.id, situacao: "aberta" },
      data: { situacao: "cancelada" },
    });
    expect(mudadas.count).toBe(0);
  });

  it("não acha o cliente nem o horário do outro estúdio", async () => {
    const db = await banco();

    expect(
      await db.cliente.findFirst({
        where: { id: outro.cliente.id, usuarioId: um.usuario.id },
      }),
    ).toBeNull();

    expect(
      await db.agendamento.findFirst({
        where: { id: outro.agendamento.id, usuarioId: um.usuario.id },
      }),
    ).toBeNull();
  });

  it("a lista de cobranças só traz as do próprio estúdio", async () => {
    const db = await banco();
    const lista = await db.cobranca.findMany({ where: { usuarioId: um.usuario.id } });
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe(um.cobranca.id);
  });
});

/**
 * Recuperação de senha.
 *
 * O que não pode acontecer aqui é grave: um código que serve duas vezes, ou um
 * código que continua valendo depois de outro ter sido usado, abre a conta de
 * um cliente para quem não devia.
 */
describe.skipIf(!TEM_BANCO)("recuperação de senha", () => {
  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("o código não fica guardado em texto, só o resumo", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("senha1");

    const { gerarCodigo, resumoDoCodigo, validadeAPartirDe } = await import("@/lib/senha");
    const codigo = gerarCodigo();

    await db.pedidoDeSenha.create({
      data: {
        usuarioId: estudio.usuario.id,
        codigoHash: resumoDoCodigo(codigo),
        expiraEm: validadeAPartirDe(),
      },
    });

    const guardado = await db.pedidoDeSenha.findFirstOrThrow({
      where: { usuarioId: estudio.usuario.id },
    });
    expect(guardado.codigoHash).not.toBe(codigo);
    expect(guardado.codigoHash).toHaveLength(64);

    // E o resumo encontra o pedido pelo índice, que é como a conferência faz.
    const achado = await db.pedidoDeSenha.findUnique({
      where: { codigoHash: resumoDoCodigo(codigo) },
    });
    expect(achado?.id).toBe(guardado.id);
  });

  it("o mesmo código não troca a senha duas vezes", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("senha2");

    const { gerarCodigo, resumoDoCodigo, validadeAPartirDe } = await import("@/lib/senha");
    const pedido = await db.pedidoDeSenha.create({
      data: {
        usuarioId: estudio.usuario.id,
        codigoHash: resumoDoCodigo(gerarCodigo()),
        expiraEm: validadeAPartirDe(),
      },
    });

    // É a mesma condição da ação de verdade.
    const primeira = await db.pedidoDeSenha.updateMany({
      where: { id: pedido.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    const segunda = await db.pedidoDeSenha.updateMany({
      where: { id: pedido.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });

    expect(primeira.count).toBe(1);
    expect(segunda.count).toBe(0);
  });

  it("trocar a senha sobe a versão da sessão, que derruba quem estava dentro", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("senha3");

    expect(estudio.usuario.sessaoVersao).toBe(0);

    const depois = await db.usuario.update({
      where: { id: estudio.usuario.id },
      data: { senhaHash: "novo", sessaoVersao: { increment: 1 } },
      select: { sessaoVersao: true },
    });

    // O cookie antigo carrega a versão 0 e passa a discordar do banco.
    expect(depois.sessaoVersao).toBe(1);
    expect(depois.sessaoVersao).not.toBe(estudio.usuario.sessaoVersao);
  });

  it("gerar um link novo derruba os pendentes da mesma conta", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("senha4");

    const { gerarCodigo, resumoDoCodigo, validadeAPartirDe } = await import("@/lib/senha");

    const antigo = await db.pedidoDeSenha.create({
      data: {
        usuarioId: estudio.usuario.id,
        codigoHash: resumoDoCodigo(gerarCodigo()),
        expiraEm: validadeAPartirDe(),
      },
    });

    await db.pedidoDeSenha.updateMany({
      where: { usuarioId: estudio.usuario.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    await db.pedidoDeSenha.create({
      data: {
        usuarioId: estudio.usuario.id,
        codigoHash: resumoDoCodigo(gerarCodigo()),
        expiraEm: validadeAPartirDe(),
      },
    });

    const velho = await db.pedidoDeSenha.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(velho.usadoEm).not.toBeNull();

    const vivos = await db.pedidoDeSenha.count({
      where: { usuarioId: estudio.usuario.id, usadoEm: null },
    });
    expect(vivos).toBe(1);
  });

  it("apagar a conta leva os pedidos de senha junto", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("senha5");

    const { gerarCodigo, resumoDoCodigo, validadeAPartirDe } = await import("@/lib/senha");
    await db.pedidoDeSenha.create({
      data: {
        usuarioId: estudio.usuario.id,
        codigoHash: resumoDoCodigo(gerarCodigo()),
        expiraEm: validadeAPartirDe(),
      },
    });

    await db.usuario.delete({ where: { id: estudio.usuario.id } });
    expect(await db.pedidoDeSenha.count({ where: { usuarioId: estudio.usuario.id } })).toBe(0);
  });
});
