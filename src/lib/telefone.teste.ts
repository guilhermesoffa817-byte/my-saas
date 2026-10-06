import { describe, expect, it } from "vitest";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";

describe("telefone para o WhatsApp", () => {
  it("acrescenta o país em celular de onze dígitos", () => {
    expect(telefoneParaWhatsApp("(66) 99251-3501")).toEqual({
      certo: true,
      paraWhatsApp: "5566992513501",
    });
  });

  it("acrescenta o país em fixo de dez dígitos", () => {
    expect(telefoneParaWhatsApp("66 3025-1234")).toEqual({
      certo: true,
      paraWhatsApp: "556630251234",
    });
  });

  it("mantém quem já veio com o país", () => {
    expect(telefoneParaWhatsApp("+55 66 99251-3501")).toEqual({
      certo: true,
      paraWhatsApp: "5566992513501",
    });
    expect(telefoneParaWhatsApp("556630251234")).toEqual({
      certo: true,
      paraWhatsApp: "556630251234",
    });
  });

  it("não confunde o DDD 55 com o código do país", () => {
    // Caxias do Sul: onze dígitos começando com 55, e ainda assim precisa do país.
    expect(telefoneParaWhatsApp("(55) 99999-8888")).toEqual({
      certo: true,
      paraWhatsApp: "5555999998888",
    });
    // Fixo da mesma região: dez dígitos começando com 55.
    expect(telefoneParaWhatsApp("55 3221-1234")).toEqual({
      certo: true,
      paraWhatsApp: "555532211234",
    });
  });

  it("recusa o que não dá para adivinhar", () => {
    for (const ruim of ["", "123", "99251-3501", "4466992513501", "5566992513501999"]) {
      expect(telefoneParaWhatsApp(ruim).certo).toBe(false);
    }
  });

  it("recusa telefone ausente sem quebrar", () => {
    expect(telefoneParaWhatsApp(null).certo).toBe(false);
    expect(telefoneParaWhatsApp(undefined).certo).toBe(false);
  });
});

describe("link do WhatsApp", () => {
  it("escapa o texto da mensagem", () => {
    const link = linkDoWhatsApp("5566992513501", "Oi, Marina! R$ 120,00 & obrigada");
    expect(link.startsWith("https://wa.me/5566992513501?text=")).toBe(true);
    expect(link).toContain("%26");
    expect(link).not.toContain(" ");
  });
});
