import { afterEach, describe, expect, it, vi } from "vitest";
import { RECURSOS, soNoCompleto } from "@/lib/recursos";
import { NA_FRASE_DO_COMPLETO, oQueOCompletoLibera } from "./completo";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a faixa 'Essa parte é do plano Completo'", () => {
  it("sem a chave da IA não cita documentos, assistente nem IA", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
    const frase = oQueOCompletoLibera();
    expect(frase).toBe(
      "O Completo libera lembretes de cobrança, contas a pagar, custos, relatório para o contador e equipe.",
    );
    expect(frase).not.toMatch(/documento|assistente|\bIA\b|intelig/i);
  });

  it("com a IA e o espaço de arquivos ligados, as duas partes voltam sozinhas", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
    vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
    expect(oQueOCompletoLibera()).toBe(
      "O Completo libera lembretes de cobrança, contas a pagar, leitura de documentos, custos, relatório para o contador, equipe e o assistente.",
    );
  });

  it("todo recurso do Completo tem a sua palavra na frase, e só os do Completo", () => {
    const naFrase = NA_FRASE_DO_COMPLETO.map(([recurso]) => recurso);
    expect(new Set(naFrase)).toEqual(new Set(RECURSOS.filter(soNoCompleto)));
  });
});
