import { describe, expect, it, vi } from "vitest";
import { copiarTexto } from "./botao";

/** Um `document` de mentira, só com o que o plano B usa. */
function documentoFalso(copia: boolean | "erro") {
  const campos: { value: string; remove: () => void }[] = [];
  const documento = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => {
      const campo = {
        value: "",
        style: {} as Record<string, string>,
        setAttribute: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn(),
        remove: vi.fn(),
      };
      campos.push(campo);
      return campo;
    }),
    execCommand: vi.fn(() => {
      if (copia === "erro") throw new Error("bloqueado");
      return copia;
    }),
  };
  return { documento: documento as unknown as Document, campos };
}

describe("copiar o código Pix", () => {
  it("diz que copiou quando a área de transferência aceita", async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await copiarTexto("000201", { clipboard: { writeText }, documento: null })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("000201");
  });

  it("quando a área de transferência recusa, copia pelo jeito antigo", async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException("negado", "NotAllowedError");
    });
    const { documento, campos } = documentoFalso(true);
    expect(await copiarTexto("000201", { clipboard: { writeText }, documento })).toBe(true);
    expect(campos[0].value).toBe("000201");
    // O campo escondido não fica para trás na página.
    expect(campos[0].remove).toHaveBeenCalled();
  });

  it("sem área de transferência (navegador dentro de aplicativo), tenta o jeito antigo", async () => {
    const { documento } = documentoFalso(true);
    expect(await copiarTexto("000201", { clipboard: undefined, documento })).toBe(true);
  });

  it("NÃO diz que copiou quando nada funcionou", async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException("negado", "NotAllowedError");
    });
    expect(await copiarTexto("000201", { clipboard: { writeText }, documento: documentoFalso(false).documento })).toBe(false);
    expect(await copiarTexto("000201", { clipboard: null, documento: documentoFalso("erro").documento })).toBe(false);
    expect(await copiarTexto("000201", { clipboard: null, documento: null })).toBe(false);
  });
});
