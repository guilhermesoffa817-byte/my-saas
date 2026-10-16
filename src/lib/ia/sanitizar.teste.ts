import { describe, expect, it } from "vitest";
import { LIMITE_PARA_IA, ocultarNomes, sanitizarParaIA } from "./sanitizar";

describe("sanitizarParaIA: o que não vai para a IA", () => {
  it("tira CPF e CNPJ, com e sem pontuação", () => {
    expect(sanitizarParaIA("Reembolso 123.456.789-09")).toBe("Reembolso [cpf]");
    expect(sanitizarParaIA("Reembolso 12345678909 ok")).toBe("Reembolso [cpf] ok");
    expect(sanitizarParaIA("Fornecedor 12.345.678/0001-95")).toBe("Fornecedor [cnpj]");
    expect(sanitizarParaIA("Fornecedor 12345678000195")).toBe("Fornecedor [cnpj]");
  });

  it("tira e-mail, telefone e chave Pix aleatória", () => {
    expect(sanitizarParaIA("Nota para juliana.prado+nf@exemplo.com.br")).toBe("Nota para [e-mail]");
    expect(sanitizarParaIA("Ligar (65) 99999-0000")).toBe("Ligar [telefone]");
    expect(sanitizarParaIA("Ligar +55 65 99999-0000")).toBe("Ligar [telefone]");
    expect(sanitizarParaIA("Ligar 6533221100")).toBe("Ligar [telefone]");
    expect(sanitizarParaIA("Pix 123e4567-e89b-42d3-a456-426614174000 pago")).toBe("Pix [chave] pago");
  });

  it("deixa valores e datas em paz", () => {
    for (const texto of [
      "Aluguel de outubro R$ 1.234,56",
      "Compra de R$ 12.345.678,90 em equipamentos",
      "Pago em 12/10/2026 às 10:30",
      "Parcela 3/12 de 450,00",
    ]) {
      expect(sanitizarParaIA(texto)).toBe(texto);
    }
  });

  it("corta em 200 caracteres, depois de limpar", () => {
    expect(LIMITE_PARA_IA).toBe(200);
    expect(sanitizarParaIA("Materiais de limpeza ".repeat(20))).toHaveLength(200);
    const limpo = sanitizarParaIA(`${"x".repeat(195)} 123.456.789-09`);
    expect(limpo).not.toMatch(/\d/);
  });
});

describe("ocultarNomes", () => {
  it("troca nome e sobrenome conhecidos por [nome], sem acento importar a caixa", () => {
    const nomes = ["Maria Fernanda Lima", "Rafael Souza", "Ana"];
    expect(ocultarNomes("Vale para Rafael Souza", nomes)).toBe("Vale para [nome]");
    expect(ocultarNomes("Reembolso MARIA FERNANDA", nomes)).toBe("Reembolso [nome]");
    expect(ocultarNomes("Bônus — Rafael S.", nomes)).toBe("Bônus — [nome] S.");
    expect(ocultarNomes("Café da Ana", nomes)).toBe("Café da [nome]");
  });

  it("não corta pedaço de palavra", () => {
    expect(ocultarNomes("Banana e limão", ["Ana Lima"])).toBe("Banana e limão");
  });

  it("sem nomes, devolve o texto como veio", () => {
    expect(ocultarNomes("Aluguel", [])).toBe("Aluguel");
  });
});
