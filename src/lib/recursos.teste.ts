import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLASSIFICACOES_POR_MES,
  PERGUNTAS_POR_MES,
  RECURSOS,
  limiteDeIa,
  podeUsar,
  recursosLiberados,
  recursosLigados,
} from "@/lib/recursos";

// Os testes de plano partem de um servidor com a IA e o espaço de arquivos
// ligados. O bloco "só vende o que está ligado" desliga de propósito.
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
  vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const AGORA = new Date("2026-10-05T12:00:00.000Z");
const futuro = new Date("2026-11-05T12:00:00.000Z");
const passado = new Date("2026-09-05T12:00:00.000Z");

const comPlano = (plano: string, status = "ativa", validaAte = futuro) => ({
  assinatura: { plano, status, validaAte },
});

const DO_NORMAL = ["cobrar", "financas"] as const;
const DO_PRO = ["documentos", "vencimentos", "custos", "relatorio"] as const;
const DO_VIP = ["lembretes", "equipe", "assistente"] as const;

describe("liberação por plano", () => {
  it("dá cobrança pelo WhatsApp e Finanças a todos os planos", () => {
    for (const recurso of DO_NORMAL) {
      for (const plano of ["mensal", "anual", "pro_mensal", "vip_mensal"]) {
        expect(podeUsar(comPlano(plano), recurso, AGORA)).toBe(true);
      }
      expect(podeUsar({ assinatura: null }, recurso, AGORA)).toBe(true);
    }
  });

  it("leitura de contrato e recibo, contas, custos e relatório abrem do Pro para cima", () => {
    for (const recurso of DO_PRO) {
      expect(podeUsar(comPlano("mensal"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("anual"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("pro_mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("pro_anual"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("vip_mensal"), recurso, AGORA)).toBe(true);
    }
  });

  it("lembretes de cobrança, equipe e assistente são só do VIP", () => {
    for (const recurso of DO_VIP) {
      expect(podeUsar(comPlano("mensal"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("pro_mensal"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("pro_anual"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("vip_mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("vip_anual"), recurso, AGORA)).toBe(true);
    }
  });

  it("cobre todos os recursos da tabela nos três grupos acima", () => {
    expect([...DO_NORMAL, ...DO_PRO, ...DO_VIP].sort()).toEqual([...RECURSOS].sort());
  });

  it("fecha os planos maiores quando a assinatura vence ou não está ativa", () => {
    expect(podeUsar(comPlano("vip_mensal", "ativa", passado), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("pro_mensal", "ativa", passado), "relatorio", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "teste"), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "demonstracao"), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "expirada"), "lembretes", AGORA)).toBe(false);
  });

  it("quem ainda está no teste antigo cobra e vê Finanças", () => {
    expect(podeUsar(comPlano("mensal", "teste"), "cobrar", AGORA)).toBe(true);
    expect(podeUsar(comPlano("mensal", "teste"), "financas", AGORA)).toBe(true);
  });

  it("lista os recursos liberados de cada plano", () => {
    expect(recursosLiberados(comPlano("mensal"), AGORA).sort()).toEqual([...DO_NORMAL].sort());
    expect(recursosLiberados(comPlano("pro_anual"), AGORA).sort()).toEqual([...DO_NORMAL, ...DO_PRO].sort());
    expect(recursosLiberados(comPlano("vip_anual"), AGORA)).toEqual(RECURSOS);
  });
});

describe("franquia de IA", () => {
  it("dá a franquia ao plano que libera o recurso e zero para os outros", () => {
    expect(limiteDeIa(comPlano("pro_mensal"), "classificacao", AGORA)).toBe(CLASSIFICACOES_POR_MES);
    expect(limiteDeIa(comPlano("pro_mensal"), "leitura", AGORA)).toBeGreaterThan(0);
    expect(limiteDeIa(comPlano("pro_mensal"), "assistente", AGORA)).toBe(0);
    expect(limiteDeIa(comPlano("vip_mensal"), "classificacao", AGORA)).toBe(
      CLASSIFICACOES_POR_MES,
    );
    expect(limiteDeIa(comPlano("vip_anual"), "assistente", AGORA)).toBe(
      PERGUNTAS_POR_MES,
    );
    expect(limiteDeIa(comPlano("mensal"), "classificacao", AGORA)).toBe(0);
    expect(limiteDeIa(comPlano("vip_mensal", "ativa", passado), "assistente", AGORA)).toBe(0);
  });
});

describe("recurso desligado no servidor não é liberado para ninguém", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const vipEmDia = {
    assinatura: { status: "ativa", plano: "vip_mensal", validaAte: new Date(Date.now() + 86_400_000) },
  };

  it("sem a chave da IA, nem quem assina o VIP vê o assistente ou os documentos", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(podeUsar(vipEmDia, "assistente")).toBe(false);
    expect(podeUsar(vipEmDia, "documentos")).toBe(false);
    expect(podeUsar(vipEmDia, "custos")).toBe(true);
    expect(recursosLigados()).not.toContain("assistente");
  });

  it("com a chave da IA, o VIP volta a ver o assistente", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
    expect(podeUsar(vipEmDia, "assistente")).toBe(true);
  });
});
