import { afterEach, describe, expect, it, vi } from "vitest";
import { RECURSOS, precisaDePlanoMaior } from "@/lib/recursos";
import { NA_FRASE_DO_PLANO, oQueOPlanoLibera } from "./frase-do-plano";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a faixa 'Essa parte é do plano Pro/VIP'", () => {
  it("sem a chave da IA não cita leitura, assistente nem IA", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
    expect(oQueOPlanoLibera("pro")).toBe("O Pro libera contas a pagar, custos e relatório para o contador.");
    expect(oQueOPlanoLibera("vip")).toBe("O VIP tem tudo do Pro e libera lembretes de cobrança e equipe.");
    expect(oQueOPlanoLibera("pro") + oQueOPlanoLibera("vip")).not.toMatch(/leitura|assistente|\bIA\b|intelig/i);
  });

  it("com a IA e o espaço de arquivos ligados, as duas partes voltam sozinhas", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
    vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
    expect(oQueOPlanoLibera("pro")).toBe(
      "O Pro libera leitura de contrato e recibo, contas a pagar, custos e relatório para o contador.",
    );
    expect(oQueOPlanoLibera("vip")).toBe(
      "O VIP tem tudo do Pro e libera lembretes de cobrança, equipe e o assistente.",
    );
  });

  it("o Normal não tem faixa", () => {
    expect(oQueOPlanoLibera("normal")).toBe("");
  });

  it("todo recurso acima do Normal tem a sua palavra na frase, e só eles", () => {
    const naFrase = NA_FRASE_DO_PLANO.map(([recurso]) => recurso);
    expect(new Set(naFrase)).toEqual(new Set(RECURSOS.filter(precisaDePlanoMaior)));
  });
});
