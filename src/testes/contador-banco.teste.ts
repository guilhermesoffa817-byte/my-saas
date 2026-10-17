import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import {
  LIMITE_DE_TENTATIVAS_POR_HORA,
  abrirPeloCodigo,
  acessoAtual,
  gerarAcesso,
  resumoDoCodigo,
  revogarAcesso,
} from "@/lib/contador/operacoes";
import { relatorioDoMes } from "@/lib/relatorio/operacoes";

const AGORA = new Date("2026-10-16T13:00:00Z");
const IP = "ip-embaralhado-1";

type Estudio = Awaited<ReturnType<typeof montarEstudio>>;

async function comVip(estudio: Estudio, validaAte = new Date("2026-12-31T00:00:00Z")) {
  const db = await banco();
  await db.assinatura.create({
    data: { usuarioId: estudio.usuario.id, status: "ativa", plano: "vip_mensal", validaAte },
  });
}

describe.skipIf(!TEM_BANCO)("acesso do contador no banco", () => {
  let estudio: Estudio;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("contador");
    await comVip(estudio);
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("gera um código de 32 bytes e guarda só o resumo dele", async () => {
    const db = await banco();
    const codigo = await gerarAcesso(db, estudio.usuario.id, AGORA);

    expect(codigo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(codigo, "base64url")).toHaveLength(32);
    const linhas = await db.acessoDoContador.findMany();
    expect(linhas).toHaveLength(1);
    expect(linhas[0].codigoHash).toBe(resumoDoCodigo(codigo));
    expect(JSON.stringify(linhas)).not.toContain(codigo);
  });

  it("código válido abre o estúdio certo e registra o acesso", async () => {
    const db = await banco();
    const codigo = await gerarAcesso(db, estudio.usuario.id, AGORA);

    const abertura = await abrirPeloCodigo(db, codigo, IP, AGORA);
    expect(abertura).toEqual({
      situacao: "aberto",
      usuarioId: estudio.usuario.id,
      nomeNegocio: estudio.usuario.nomeNegocio,
    });
    expect((await acessoAtual(db, estudio.usuario.id))?.ultimoAcessoEm?.toISOString()).toBe(
      AGORA.toISOString(),
    );
    // Acesso certo não conta como tentativa.
    expect(await db.tentativaDoContador.count()).toBe(0);
  });

  it("revogado não abre, e gerar outro derruba o anterior", async () => {
    const db = await banco();
    const primeiro = await gerarAcesso(db, estudio.usuario.id, AGORA);
    const segundo = await gerarAcesso(db, estudio.usuario.id, AGORA);

    expect(await abrirPeloCodigo(db, primeiro, IP, AGORA)).toEqual({ situacao: "nao_encontrado" });
    expect(await abrirPeloCodigo(db, segundo, IP, AGORA)).toMatchObject({ situacao: "aberto" });

    expect(await revogarAcesso(db, estudio.usuario.id, AGORA)).toBe(true);
    expect(await abrirPeloCodigo(db, segundo, IP, AGORA)).toEqual({ situacao: "nao_encontrado" });
    expect(await acessoAtual(db, estudio.usuario.id)).toBeNull();
    expect(await db.acessoDoContador.count({ where: { revogadoEm: null } })).toBe(0);
  });

  it("código inválido conta tentativa; passou do limite, nem o certo abre naquele IP", async () => {
    const db = await banco();
    const codigo = await gerarAcesso(db, estudio.usuario.id, AGORA);

    for (let vez = 0; vez < LIMITE_DE_TENTATIVAS_POR_HORA; vez++) {
      const errado = vez % 2 === 0 ? "curto-demais" : "A".repeat(43);
      expect(await abrirPeloCodigo(db, errado, IP, AGORA)).toEqual({ situacao: "nao_encontrado" });
    }
    expect(await abrirPeloCodigo(db, codigo, IP, AGORA)).toEqual({ situacao: "bloqueado" });
    // Outro IP segue normal.
    expect(await abrirPeloCodigo(db, codigo, "outro-ip", AGORA)).toMatchObject({ situacao: "aberto" });
    // Uma hora depois, o limite zera.
    const depois = new Date(AGORA.getTime() + 61 * 60 * 1000);
    expect(await abrirPeloCodigo(db, codigo, IP, depois)).toMatchObject({ situacao: "aberto" });
  });

  it("estúdio sem o plano Completo em dia: o link não mostra nada", async () => {
    const db = await banco();
    const codigo = await gerarAcesso(db, estudio.usuario.id, AGORA);
    await db.assinatura.update({
      where: { usuarioId: estudio.usuario.id },
      data: { validaAte: new Date("2026-10-01T00:00:00Z") },
    });
    expect(await abrirPeloCodigo(db, codigo, IP, AGORA)).toEqual({ situacao: "indisponivel" });
  });

  it("isolamento: o código de um estúdio só abre o relatório dele", async () => {
    const db = await banco();
    const vizinho = await montarEstudio("vizinho");
    await comVip(vizinho);
    await db.lancamento.create({
      data: {
        usuarioId: vizinho.usuario.id,
        tipo: "entrada",
        descricao: "Do vizinho",
        valorCentavos: 555500,
        data: new Date("2026-10-10T13:00:00Z"),
      },
    });
    await db.lancamento.create({
      data: {
        usuarioId: estudio.usuario.id,
        tipo: "entrada",
        descricao: "Meu",
        valorCentavos: 1000,
        data: new Date("2026-10-10T13:00:00Z"),
      },
    });

    const meu = await gerarAcesso(db, estudio.usuario.id, AGORA);
    const dele = await gerarAcesso(db, vizinho.usuario.id, AGORA);
    // Gerar o link do vizinho não revoga o meu.
    expect(await acessoAtual(db, estudio.usuario.id)).not.toBeNull();

    const abertura = await abrirPeloCodigo(db, meu, IP, AGORA);
    if (abertura.situacao !== "aberto") throw new Error("não abriu");
    expect(abertura.usuarioId).toBe(estudio.usuario.id);
    const { relatorio } = await relatorioDoMes(db, abertura.usuarioId, "2026-10", AGORA);
    expect(relatorio.entradas.manuais.totalCentavos).toBe(1000);
    // O relatório não carrega nome de cliente nenhum.
    expect(JSON.stringify(relatorio)).not.toContain(estudio.cliente.nome);

    // Revogar o meu não mexe no do vizinho.
    await revogarAcesso(db, estudio.usuario.id, AGORA);
    expect(await abrirPeloCodigo(db, dele, IP, AGORA)).toMatchObject({
      situacao: "aberto",
      usuarioId: vizinho.usuario.id,
    });
  });
});
