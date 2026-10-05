import { describe, expect, it } from "vitest";
import { podeUsar } from "@/lib/recursos";

const AGORA = new Date("2026-10-05T12:00:00.000Z");
const futuro = new Date("2026-11-05T12:00:00.000Z");
const passado = new Date("2026-09-05T12:00:00.000Z");

const comPlano = (plano: string, status = "ativa", validaAte = futuro) => ({
  assinatura: { plano, status, validaAte },
});

describe("liberação por plano", () => {
  it("deixa qualquer plano cobrar pelo WhatsApp", () => {
    expect(podeUsar(comPlano("mensal"), "cobrar", AGORA)).toBe(true);
    expect(podeUsar(comPlano("vip_mensal"), "cobrar", AGORA)).toBe(true);
    expect(podeUsar({ assinatura: null }, "cobrar", AGORA)).toBe(true);
  });

  it("guarda lembretes, vencimentos e documentos para o VIP", () => {
    for (const recurso of ["lembretes", "vencimentos", "documentos", "financas"] as const) {
      expect(podeUsar(comPlano("mensal"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("anual"), recurso, AGORA)).toBe(false);
      expect(podeUsar(comPlano("vip_mensal"), recurso, AGORA)).toBe(true);
      expect(podeUsar(comPlano("vip_anual"), recurso, AGORA)).toBe(true);
    }
  });

  it("fecha o VIP quando a assinatura vence ou não está ativa", () => {
    expect(podeUsar(comPlano("vip_mensal", "ativa", passado), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "teste"), "lembretes", AGORA)).toBe(false);
    expect(podeUsar(comPlano("vip_mensal", "expirada"), "lembretes", AGORA)).toBe(false);
  });

  it("quem está em teste ainda consegue cobrar", () => {
    expect(podeUsar(comPlano("mensal", "teste"), "cobrar", AGORA)).toBe(true);
  });
});
