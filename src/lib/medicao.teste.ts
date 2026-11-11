import { describe, expect, it } from "vitest";
import { eventoDoParametro, idsValidos, medicaoLigada, rotaPublica } from "./medicao";

describe("medição", () => {
  it("sem códigos, nada liga", () => {
    const ids = idsValidos({});
    expect(ids).toEqual({ googleAnalytics: null, metaPixel: null, clarity: null });
    expect(medicaoLigada(ids)).toBe(false);
  });

  it("aceita os códigos no formato certo, mesmo com espaço ou letra minúscula", () => {
    const ids = idsValidos({
      GOOGLE_ANALYTICS_ID: " g-ab12cd34ef ",
      META_PIXEL_ID: "123456789012345",
      CLARITY_ID: "AbCd1234Ef",
    });
    expect(ids).toEqual({
      googleAnalytics: "G-AB12CD34EF",
      metaPixel: "123456789012345",
      clarity: "abcd1234ef",
    });
    expect(medicaoLigada(ids)).toBe(true);
  });

  it("recusa código errado ou com algo que poderia virar script", () => {
    const ids = idsValidos({
      GOOGLE_ANALYTICS_ID: "UA-12345-1",
      META_PIXEL_ID: "123'); alert(1);//",
      CLARITY_ID: "abc",
    });
    expect(medicaoLigada(ids)).toBe(false);
  });

  it("só mede páginas públicas", () => {
    for (const caminho of ["/", "/criar-conta", "/entrar", "/privacidade", "/termos"]) {
      expect(rotaPublica(caminho)).toBe(true);
    }
    for (const caminho of ["/painel", "/painel/agenda", "/agendar/estudio", "/contador/abc", "/nova-senha", "/api/saude"]) {
      expect(rotaPublica(caminho)).toBe(false);
    }
    expect(rotaPublica("/painelzinho")).toBe(true);
  });

  it("só reconhece os eventos combinados", () => {
    expect(eventoDoParametro("conta")).toBe("conta");
    expect(eventoDoParametro("demonstracao")).toBe("demonstracao");
    expect(eventoDoParametro("outro")).toBeNull();
    expect(eventoDoParametro(null)).toBeNull();
  });
});
