import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { deDataPura, paraDataPura } from "@/lib/formato";

const dia = (texto: string) => deDataPura(texto)!;

describe.skipIf(!TEM_BANCO)("documentos no banco", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    const db = await banco();
    await db.itemDoDocumento.deleteMany();
    await db.documento.deleteMany();
    estudio = await montarEstudio("documento");
  });

  afterAll(async () => {
    const db = await banco();
    await db.itemDoDocumento.deleteMany();
    await db.documento.deleteMany();
    await limpar();
    await db.$disconnect();
  });

  async function documentoComItem() {
    const db = await banco();
    const documento = await db.documento.create({
      data: {
        usuarioId: estudio.usuario.id,
        nome: "Contrato.pdf",
        caminho: `${estudio.usuario.id}/x/Contrato.pdf`,
        tipoDoArquivo: "application/pdf",
        tamanhoBytes: 1000,
        situacao: "pronto",
      },
    });
    const item = await db.itemDoDocumento.create({
      data: {
        documentoId: documento.id,
        descricao: "Aluguel",
        tipo: "saida",
        valorCentavos: 800000,
        data: dia("2026-10-30"),
      },
    });
    return { documento, item };
  }

  it("um estúdio não acha o documento nem o item do outro", async () => {
    const db = await banco();
    const { documento, item } = await documentoComItem();
    const outro = await montarEstudio("vizinho");

    expect(
      await db.documento.findFirst({ where: { id: documento.id, usuarioId: outro.usuario.id } }),
    ).toBeNull();

    // A busca do item passa pelo dono do documento, que é como a ação faz.
    expect(
      await db.itemDoDocumento.findFirst({
        where: { id: item.id, documento: { usuarioId: outro.usuario.id } },
      }),
    ).toBeNull();

    // E, com o estúdio certo, acha.
    expect(
      await db.itemDoDocumento.findFirst({
        where: { id: item.id, documento: { usuarioId: estudio.usuario.id } },
      }),
    ).not.toBeNull();
  });

  it("um estúdio não aceita o item do outro", async () => {
    const db = await banco();
    const { item } = await documentoComItem();
    const outro = await montarEstudio("vizinho2");

    const tentou = await db.itemDoDocumento.updateMany({
      where: {
        id: item.id,
        decisao: null,
        documento: { usuarioId: outro.usuario.id },
      },
      data: { decisao: "aceito" },
    });
    expect(tentou.count).toBe(0);

    const intacto = await db.itemDoDocumento.findUniqueOrThrow({ where: { id: item.id } });
    expect(intacto.decisao).toBeNull();
  });

  it("aceitar duas vezes não lança duas contas", async () => {
    const db = await banco();
    const { item } = await documentoComItem();

    const primeira = await db.itemDoDocumento.updateMany({
      where: { id: item.id, decisao: null },
      data: { decisao: "aceito" },
    });
    const segunda = await db.itemDoDocumento.updateMany({
      where: { id: item.id, decisao: null },
      data: { decisao: "aceito" },
    });

    expect(primeira.count).toBe(1);
    expect(segunda.count).toBe(0);
  });

  it("apagar o documento leva os itens junto", async () => {
    const db = await banco();
    const { documento } = await documentoComItem();

    await db.documento.deleteMany({
      where: { id: documento.id, usuarioId: estudio.usuario.id },
    });

    expect(await db.itemDoDocumento.count({ where: { documentoId: documento.id } })).toBe(0);
  });

  it("a data do item volta no mesmo dia em que entrou", async () => {
    const db = await banco();
    const { item } = await documentoComItem();
    const lido = await db.itemDoDocumento.findUniqueOrThrow({ where: { id: item.id } });
    expect(paraDataPura(lido.data!)).toBe("2026-10-30");
  });
});
