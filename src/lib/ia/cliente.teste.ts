import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { fallbackDoModelo, iaConfigurada, modeloDaIa, traduzirErroIA } from "./cliente";

describe("cliente da IA", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("usa o modelo da leitura de documentos, trocável pelo ambiente", () => {
    delete process.env.ANTHROPIC_MODELO;
    expect(modeloDaIa()).toBe("claude-sonnet-5-5");
    process.env.ANTHROPIC_MODELO = "claude-opus-5-5";
    expect(modeloDaIa()).toBe("claude-opus-5-5");
  });

  it("lê a chave na hora da chamada", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(iaConfigurada()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "sk-teste";
    expect(iaConfigurada()).toBe(true);
  });

  it("só pede fallback para modelo que aceita a forma padrão", () => {
    expect(fallbackDoModelo("claude-sonnet-5-5")).toEqual({
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(fallbackDoModelo("claude-haiku-5-5")).toEqual({});
  });

  it("traduz os erros do SDK, das subclasses para a mãe", () => {
    const cabecalhos = new Headers();
    expect(traduzirErroIA(new Anthropic.RateLimitError(429, undefined, "x", cabecalhos)).codigo).toBe("limite");
    expect(traduzirErroIA(new Anthropic.AuthenticationError(401, undefined, "x", cabecalhos)).codigo).toBe("config");
    expect(traduzirErroIA(new Anthropic.BadRequestError(400, undefined, "x", cabecalhos)).codigo).toBe("pedido");
    // Como o SDK monta o erro de uma resposta 529 de verdade.
    const sobrecarga = Anthropic.APIError.generate(
      529,
      { type: "error", error: { type: "overloaded_error", message: "x" } },
      "x",
      cabecalhos,
    );
    expect(sobrecarga).toBeInstanceOf(Anthropic.InternalServerError);
    expect(traduzirErroIA(sobrecarga).codigo).toBe("sobrecarga");
    expect(traduzirErroIA(new Anthropic.APIConnectionTimeoutError()).codigo).toBe("tempo");
    expect(traduzirErroIA(new Anthropic.APIConnectionError({ message: "x" })).codigo).toBe("rede");
    expect(traduzirErroIA(new Anthropic.APIUserAbortError()).codigo).toBe("cancelado");
    expect(traduzirErroIA(new Error("qualquer")).codigo).toBe("desconhecido");
  });
});
