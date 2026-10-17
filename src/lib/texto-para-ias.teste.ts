import { afterEach, describe, expect, it, vi } from "vitest";
import { textoParaIas } from "@/lib/texto-para-ias";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("texto para as IAs (/llms.txt)", () => {
  it("traz os dois planos com os preços da página de vendas", () => {
    const texto = textoParaIas();
    expect(texto).toMatch(/### Simples: R\$\s189,00 por mês ou R\$\s1\.890,00 por ano/);
    expect(texto).toMatch(/### Completo: R\$\s329,00 por mês ou R\$\s2\.569,00 por ano/);
    expect(texto).toContain("/criar-conta");
  });

  it("não fala de IA quando ela está desligada no servidor", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const texto = textoParaIas();
    expect(texto).not.toMatch(/assistente|lida pela IA/i);
  });

  it("fala do assistente quando a IA está ligada", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
    expect(textoParaIas()).toMatch(/Assistente que responde/);
  });
});
