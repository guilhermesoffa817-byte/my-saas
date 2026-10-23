import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEM_BANCO, banco, limpar } from "./banco";
import { PLANOS } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";

/**
 * A assinatura com banco de verdade: o aviso de Pix (um só por conta, mesmo
 * com várias abas) e a confirmação do admin, que aplica a regra de troca de
 * plano. As ações são as da tela; só a sessão e o redirecionamento do Next são
 * trocados.
 */

class Redirecionou extends Error {
  constructor(public destino: string) {
    super(`redirect: ${destino}`);
  }
}

const sessao = vi.hoisted(() => ({ usuario: null as unknown }));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
}));
vi.mock("@/lib/sessao", () => ({
  usuarioAtual: async () => sessao.usuario,
  criarSessao: async () => undefined,
  encerrarSessao: async () => undefined,
}));

const DIA = 86_400_000;

type NovaAssinatura = { status: string; plano: string; validaAte: Date };

let contador = 0;
async function novaConta(assinatura?: NovaAssinatura, papel = "dona") {
  const db = await banco();
  contador += 1;
  return db.usuario.create({
    data: {
      nome: `Pessoa ${contador}`,
      email: `assinatura-${contador}@teste.com.br`,
      senhaHash: "x",
      nomeNegocio: `Estúdio ${contador}`,
      papel,
      ...(assinatura ? { assinatura: { create: assinatura } } : {}),
    },
    include: { assinatura: true },
  });
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

async function avisar(plano: string, observacao = "") {
  const { avisarPagamento } = await import("@/app/painel/assinatura/acoes");
  return avisarPagamento(null, formulario({ plano, observacao }));
}

/** Avisa o Pix como a conta e confirma como o admin. Devolve a assinatura depois. */
async function pagar(conta: { id: string }, plano: string) {
  const db = await banco();
  const pessoa = await db.usuario.findUniqueOrThrow({ where: { id: conta.id }, include: { assinatura: true } });
  sessao.usuario = pessoa;
  await avisar(plano);
  const pagamento = await db.pagamento.findFirstOrThrow({ where: { usuarioId: conta.id, status: "aguardando" } });

  sessao.usuario = await novaConta(undefined, "admin");
  const { confirmarPagamento } = await import("@/app/painel/admin/acoes");
  await confirmarPagamento(formulario({ id: pagamento.id, plano: pagamento.plano, valorCentavos: String(pagamento.valorCentavos) }));
  return db.assinatura.findUniqueOrThrow({ where: { usuarioId: conta.id } });
}

/** O instante bate com o esperado, com folga para o tempo do próprio teste. */
function perto(data: Date, esperado: number) {
  expect(Math.abs(data.getTime() - esperado)).toBeLessThan(10_000);
}

describe.skipIf(!TEM_BANCO)("assinatura", () => {
  beforeEach(async () => {
    await limpar();
    sessao.usuario = null;
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  describe("aviso de Pix: um só por conta", () => {
    it("trocar de plano com um aviso esperando atualiza o aviso: plano, valor e recado", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;

      expect((await avisar("mensal"))?.recado).toMatch(/Obrigado por avisar/);
      const resposta = await avisar("vip_anual", "Mudei de ideia, paguei o Completo anual");
      expect(resposta?.recado).toBe(
        `Atualizamos o seu aviso para Completo anual (${emReais(256900)}). Vamos conferir o Pix com esse valor.`,
      );

      const db = await banco();
      const avisos = await db.pagamento.findMany({ where: { usuarioId: conta.id } });
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({
        status: "aguardando",
        plano: "vip_anual",
        valorCentavos: PLANOS.vip_anual.valorCentavos,
        observacao: "Mudei de ideia, paguei o Completo anual",
      });
    });

    it("avisar de novo o mesmo plano guarda o recado novo, sem criar outro aviso", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;
      await avisar("vip_mensal");
      const resposta = await avisar("vip_mensal", "Paguei pelo banco às 14h");
      expect(resposta?.recado).toMatch(/já está conosco.*Guardamos o seu recado/);

      const db = await banco();
      const avisos = await db.pagamento.findMany({ where: { usuarioId: conta.id } });
      expect(avisos).toHaveLength(1);
      expect(avisos[0].observacao).toBe("Paguei pelo banco às 14h");
    });

    it("várias abas tocando em 'Já fiz o Pix' ao mesmo tempo gravam um aviso só", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;

      const respostas = await Promise.all(Array.from({ length: 12 }, () => avisar("mensal")));
      expect(respostas.every((resposta) => Boolean(resposta?.recado))).toBe(true);

      const db = await banco();
      expect(await db.pagamento.count({ where: { usuarioId: conta.id, status: "aguardando" } })).toBe(1);
    });

    it("duas abas com planos diferentes ao mesmo tempo: fica um aviso, com um dos dois planos inteiro", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;

      await Promise.all([avisar("mensal"), avisar("vip_anual"), avisar("mensal"), avisar("vip_anual")]);

      const db = await banco();
      const avisos = await db.pagamento.findMany({ where: { usuarioId: conta.id } });
      expect(avisos).toHaveLength(1);
      // Plano e valor andam juntos: nunca o plano de um com o valor do outro.
      expect(avisos[0].valorCentavos).toBe(PLANOS[avisos[0].plano as keyof typeof PLANOS].valorCentavos);
    });

    it("o banco recusa um segundo aviso esperando na mesma conta, mesmo gravado por fora da tela", async () => {
      const conta = await novaConta();
      const db = await banco();
      const aviso = { usuarioId: conta.id, plano: "mensal", valorCentavos: 18900, competencia: "2026-10" };
      await db.pagamento.create({ data: aviso });
      await expect(db.pagamento.create({ data: aviso })).rejects.toMatchObject({ code: "P2002" });
      // Confirmados e recusados não contam: a conta tem um histórico inteiro deles.
      await db.pagamento.create({ data: { ...aviso, status: "confirmado" } });
      await db.pagamento.create({ data: { ...aviso, status: "confirmado" } });
      await db.pagamento.create({ data: { ...aviso, status: "recusado" } });
    });

    it("aviso trocado depois que o admin abriu a tela não é confirmado com o plano novo", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;
      await avisar("mensal");
      const db = await banco();
      const visto = await db.pagamento.findFirstOrThrow({ where: { usuarioId: conta.id } });
      // A cliente troca para o Completo anual antes do clique do admin.
      await avisar("vip_anual");

      sessao.usuario = await novaConta(undefined, "admin");
      const { confirmarPagamento } = await import("@/app/painel/admin/acoes");
      await confirmarPagamento(formulario({ id: visto.id, plano: visto.plano, valorCentavos: String(visto.valorCentavos) }));

      const depois = await db.pagamento.findUniqueOrThrow({ where: { id: visto.id } });
      expect(depois).toMatchObject({ status: "aguardando", plano: "vip_anual" });
    });

    it("dois cliques em 'Confirmar' liberam os dias uma vez só", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;
      await avisar("mensal");
      const db = await banco();
      const pagamento = await db.pagamento.findFirstOrThrow({ where: { usuarioId: conta.id } });

      sessao.usuario = await novaConta(undefined, "admin");
      const { confirmarPagamento } = await import("@/app/painel/admin/acoes");
      await Promise.all([
        confirmarPagamento(formulario({ id: pagamento.id, plano: "mensal", valorCentavos: String(pagamento.valorCentavos) })),
        confirmarPagamento(formulario({ id: pagamento.id, plano: "mensal", valorCentavos: String(pagamento.valorCentavos) })),
      ]);

      const assinatura = await db.assinatura.findUniqueOrThrow({ where: { usuarioId: conta.id } });
      expect(assinatura).toMatchObject({ status: "ativa", plano: "mensal" });
      perto(assinatura.validaAte, Date.now() + 30 * DIA);
    });

    it("Pix não localizado aparece para a pessoa, que pode avisar de novo", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      sessao.usuario = conta;
      await avisar("mensal");
      const db = await banco();
      const pagamento = await db.pagamento.findFirstOrThrow({ where: { usuarioId: conta.id } });

      sessao.usuario = await novaConta(undefined, "admin");
      const { recusarPagamento } = await import("@/app/painel/admin/acoes");
      await recusarPagamento(formulario({ id: pagamento.id }));

      const { situacaoDoUsuario } = await import("@/lib/guardas");
      const situacao = await situacaoDoUsuario(conta);
      expect(situacao.pixNaoLocalizado).toBe(true);
      expect(situacao.demonstracao).toBe(true);

      sessao.usuario = conta;
      await avisar("mensal");
      expect(await db.pagamento.count({ where: { usuarioId: conta.id } })).toBe(2);
    });
  });

  describe("migração dos avisos repetidos que já existem", () => {
    const INDICE = `CREATE UNIQUE INDEX IF NOT EXISTS "Pagamento_um_aguardando_por_conta" ON "Pagamento" ("usuarioId") WHERE "status" = 'aguardando'`;

    afterAll(async () => {
      // Se o teste parar no meio, o índice volta mesmo assim.
      await (await banco()).$executeRawUnsafe(INDICE);
    });

    it("fica o aviso mais novo de cada conta; os outros viram 'repetido', sem apagar nada", async () => {
      const db = await banco();
      const caminho = join(__dirname, "..", "..", "prisma", "migrations", "20261019130000_um_pix_aguardando_por_conta", "migration.sql");
      const comandos = readFileSync(caminho, "utf8")
        .split("\n")
        .filter((linha) => !linha.trimStart().startsWith("--"))
        .join("\n")
        .split(/;\s*$/m)
        .map((comando) => comando.trim())
        .filter(Boolean);
      expect(comandos).toHaveLength(2);

      // Como estava antes da regra: duas abas tinham gravado avisos repetidos.
      await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Pagamento_um_aguardando_por_conta"`);
      const ana = await novaConta();
      const bia = await novaConta();
      const base = { competencia: "2026-10", valorCentavos: 18900, plano: "mensal" };
      const antigo = await db.pagamento.create({ data: { ...base, usuarioId: ana.id, criadoEm: new Date("2026-10-18T10:00:00Z") } });
      const meio = await db.pagamento.create({ data: { ...base, usuarioId: ana.id, criadoEm: new Date("2026-10-18T10:00:01Z") } });
      const novo = await db.pagamento.create({
        data: { ...base, usuarioId: ana.id, plano: "vip_anual", valorCentavos: 256900, criadoEm: new Date("2026-10-18T10:00:02Z") },
      });
      const pago = await db.pagamento.create({ data: { ...base, usuarioId: ana.id, status: "confirmado" } });
      const daBia = await db.pagamento.create({ data: { ...base, usuarioId: bia.id } });

      for (const comando of comandos) await db.$executeRawUnsafe(comando);

      const status = async (id: string) => (await db.pagamento.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(novo.id)).toBe("aguardando");
      expect(await status(antigo.id)).toBe("repetido");
      expect(await status(meio.id)).toBe("repetido");
      expect(await status(pago.id)).toBe("confirmado");
      expect(await status(daBia.id)).toBe("aguardando");
      expect(await db.pagamento.count({ where: { usuarioId: ana.id } })).toBe(4);

      // E o índice voltou: um segundo aviso esperando é recusado.
      await expect(db.pagamento.create({ data: { ...base, usuarioId: bia.id } })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  describe("confirmação do Pix: regra de troca de plano", () => {
    it("mesma família: renovar o Completo mensal soma os dias ao que já vale", async () => {
      const validaAte = new Date(Date.now() + 20 * DIA);
      const conta = await novaConta({ status: "ativa", plano: "vip_mensal", validaAte });
      const assinatura = await pagar(conta, "vip_mensal");
      expect(assinatura.plano).toBe("vip_mensal");
      perto(assinatura.validaAte, validaAte.getTime() + 30 * DIA);
    });

    it("mesma família, outro período: do Simples mensal para o Simples anual", async () => {
      const validaAte = new Date(Date.now() + 10 * DIA);
      const conta = await novaConta({ status: "ativa", plano: "mensal", validaAte });
      const assinatura = await pagar(conta, "anual");
      expect(assinatura.plano).toBe("anual");
      perto(assinatura.validaAte, validaAte.getTime() + 365 * DIA);
    });

    it("subir: Simples mensal recém-pago + Completo mensal não vira 60 dias de Completo", async () => {
      const conta = await novaConta({ status: "ativa", plano: "mensal", validaAte: new Date(Date.now() + 30 * DIA) });
      const assinatura = await pagar(conta, "vip_mensal");
      expect(assinatura.plano).toBe("vip_mensal");
      // 30 dias de Simples (R$ 189) viram 17 dias de Completo, mais os 30 pagos.
      perto(assinatura.validaAte, Date.now() + 47 * DIA);
    });

    it("descer: quem tem o Completo anual e paga o Simples mensal não perde o dinheiro do Completo", async () => {
      const conta = await novaConta({ status: "ativa", plano: "vip_anual", validaAte: new Date(Date.now() + 365 * DIA) });
      const assinatura = await pagar(conta, "mensal");
      expect(assinatura.plano).toBe("mensal");
      // R$ 2.569 de saldo ÷ R$ 6,30 por dia = 407 dias de Simples, mais os 30 pagos.
      perto(assinatura.validaAte, Date.now() + 437 * DIA);
    });

    it("sem plano ativo (demonstração): o plano pago começa agora", async () => {
      const conta = await novaConta({ status: "demonstracao", plano: "mensal", validaAte: new Date() });
      const assinatura = await pagar(conta, "vip_anual");
      expect(assinatura).toMatchObject({ status: "ativa", plano: "vip_anual" });
      perto(assinatura.validaAte, Date.now() + 365 * DIA);
    });

    it("conta sem assinatura nenhuma ganha uma, ativa", async () => {
      const conta = await novaConta();
      const assinatura = await pagar(conta, "mensal");
      expect(assinatura).toMatchObject({ status: "ativa", plano: "mensal" });
      perto(assinatura.validaAte, Date.now() + 30 * DIA);
    });

    it("vencido: o saldo que já acabou não vira crédito, e o plano novo começa agora", async () => {
      const conta = await novaConta({ status: "ativa", plano: "mensal", validaAte: new Date(Date.now() - 3 * DIA) });
      const assinatura = await pagar(conta, "vip_mensal");
      expect(assinatura.plano).toBe("vip_mensal");
      perto(assinatura.validaAte, Date.now() + 30 * DIA);
    });
  });

  describe("recurso desligado no servidor não vira oferta do Completo", () => {
    const completo = () =>
      novaConta({ status: "ativa", plano: "vip_mensal", validaAte: new Date(Date.now() + 20 * DIA) });

    it("quem já paga o Completo e abre o assistente sem a IA ligada vai para o painel", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      sessao.usuario = await completo();
      const { exigirLeituraDoRecurso, exigirEscritaDoRecurso } = await import("@/lib/guardas");
      await expect(exigirLeituraDoRecurso("assistente")).rejects.toMatchObject({ destino: "/painel" });
      await expect(exigirLeituraDoRecurso("documentos")).rejects.toMatchObject({ destino: "/painel" });
      await expect(exigirEscritaDoRecurso("assistente")).rejects.toMatchObject({ destino: "/painel" });
      // O que está ligado continua abrindo.
      await expect(exigirLeituraDoRecurso("equipe")).resolves.toBeTruthy();
    });

    it("a rota de API responde 'indisponível' e leva ao painel, sem falar em plano", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      sessao.usuario = await completo();
      const { exigirEscritaNaApi } = await import("@/lib/guardas");
      const porta = await exigirEscritaNaApi("assistente");
      expect(porta.resposta?.status).toBe(403);
      expect(await porta.resposta?.json()).toMatchObject({ codigo: "indisponivel", destino: "/painel" });
    });

    it("quem tem o Simples e abre uma parte do Completo que está ligada continua indo para os planos", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      sessao.usuario = await novaConta({ status: "ativa", plano: "mensal", validaAte: new Date(Date.now() + 20 * DIA) });
      const { exigirLeituraDoRecurso } = await import("@/lib/guardas");
      await expect(exigirLeituraDoRecurso("equipe")).rejects.toMatchObject({
        destino: "/painel/assinatura?completo=1",
      });
      // E o desligado, nem para ela vira oferta.
      await expect(exigirLeituraDoRecurso("assistente")).rejects.toMatchObject({ destino: "/painel" });
    });
  });
});
