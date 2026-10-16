import { describe, expect, it } from "vitest";
import {
  CLASSIFICACOES_POR_MES_NO_COMPLETO,
  PERGUNTAS_POR_MES_NO_COMPLETO,
  RECURSOS,
  limiteDeIa,
  podeUsar,
  recursosLiberados,
} from "@/lib/recursos";

const AGORA = new Date("2026-10-05T12:00:00.000Z");
const futuro = new Date("2026-11-05T12:00:00.000Z");
const passado = new Date("2026-09-05T12:00:00.000Z");

const comPlano = (plano: string, status = "ativa", validaAte = futuro) => ({
  assinatura: { plano, status, validaAte },
});

const DO_SIMPLES = ["cobrar", "financas"] as const;
const DO_COMPLETO = [
  "lembretes",
  "vencimentos",
  "documentos",
  "relatorio",
  "equipe",
  "custos",
  "assistente",
] as const;

describe("liberação por plano", () => {
  it("dá cobrança pelo WhatsApp e Finanças aos dois planos", () => {
    for (const recurso of DO_SIMPLES) {
      expect(podeUsar(comPlano("mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("anual"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("vip_mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar({ assinatura: null }, recurso, AGORA)).toBe(true);
    }
  });

  it("guarda lembretes, contas, documentos, relatório, equipe, custos e assistente para o Completo", () => {
    for (const recurso of DO_COMPLETO) {
      expect(podeUsar(comPlano("mensal"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("anual"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("vip_mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("vip_anual"), recurso, AGORA)).toBe(true);
    }
  });

  it("cobre todos os recursos da tabela nos dois grupos acima", () => {
    expect([...DO_SIMPLES, ...DO_COMPLETO].sort()).toEqual([...RECURSOS].sort());
  });

  it("fecha o Completo quando a assinatura vence ou não está ativa", () => {
    expect(podeUsar(comPlano("vip_mensal", "ativa", passado), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "teste"), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "demonstracao"), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "expirada"), "lembretes", AGORA)).toBe(false);
  });

  it("quem ainda está no teste antigo cobra e vê Finanças", () => {
    expect(podeUsar(comPlano("mensal", "teste"), "cobrar", AGORA)).toBe(true);
    expect(podeUsar(comPlano("mensal", "teste"), "financas", AGORA)).toBe(true);
  });

  it("lista os recursos liberados de cada plano", () => {
    expect(recursosLiberados(comPlano("mensal"), AGORA).sort()).toEqual([...DO_SIMPLES].sort());
    expect(recursosLiberados(comPlano("vip_anual"), AGORA)).toEqual(RECURSOS);
  });
});

describe("franquia de IA", () => {
  it("dá a franquia do Completo e zero para quem não tem o plano em dia", () => {
    expect(limiteDeIa(comPlano("vip_mensal"), "classificacao", AGORA)).toBe(
      CLASSIFICACOES_POR_MES_NO_COMPLETO,
    );
    expect(limiteDeIa(comPlano("vip_anual"), "assistente", AGORA)).toBe(
      PERGUNTAS_POR_MES_NO_COMPLETO,
    );
    expect(limiteDeIa(comPlano("mensal"), "classificacao", AGORA)).toBe(0);
    expect(limiteDeIa(comPlano("vip_mensal", "ativa", passado), "assistente", AGORA)).toBe(0);
  });
});
