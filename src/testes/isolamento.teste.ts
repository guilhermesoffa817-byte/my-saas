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
