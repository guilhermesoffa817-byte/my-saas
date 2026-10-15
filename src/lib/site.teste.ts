import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { ENDERECO_DO_SITE, PAGINAS_PUBLICAS } from "@/lib/site";

describe("páginas públicas", () => {
  it("inclui as páginas legais", () => {
    const caminhos = PAGINAS_PUBLICAS.map((pagina) => pagina.caminho);
    expect(caminhos).toContain("/termos");
    expect(caminhos).toContain("/privacidade");
  });

  it("não repete página nem deixa caminho sem a barra", () => {
    const caminhos = PAGINAS_PUBLICAS.map((pagina) => pagina.caminho);
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const caminho of caminhos) expect(caminho.startsWith("/")).toBe(true);
  });

  it("nunca põe o painel no sitemap", () => {
    for (const { caminho } of PAGINAS_PUBLICAS) {
      expect(caminho.startsWith("/painel")).toBe(false);
    }
  });

  it("o sitemap sai da mesma lista, com endereço completo", () => {
    const enderecos = sitemap().map((item) => item.url);
    expect(enderecos).toEqual(PAGINAS_PUBLICAS.map((p) => `${ENDERECO_DO_SITE}${p.caminho}`));
    expect(enderecos).toContain(`${ENDERECO_DO_SITE}/termos`);
  });
});
