import { describe, expect, it } from "vitest";
import { aPreencher, lerEmpresa, whatsappDoBossa } from "@/lib/empresa";

const COMPLETO = {
  EMPRESA_NOME: "  Bossa Sistemas Ltda  ",
  EMPRESA_DOCUMENTO: "11.222.333/0001-81",
  CONTATO_EMAIL: " Contato@Bossa.com.br ",
  CONTATO_WHATSAPP: "(66) 99251-3501",
};

describe("dados da empresa", () => {
  it("lê, limpa e formata quando está tudo preenchido", () => {
    expect(lerEmpresa(COMPLETO)).toEqual({
      nome: "Bossa Sistemas Ltda",
      documento: "11.222.333/0001-81",
      tipoDoDocumento: "CNPJ",
      email: "contato@bossa.com.br",
      whatsapp: "(66) 99251-3501",
      whatsappComPais: "5566992513501",
      dadosCompletos: true,
    });
  });

  it("aceita CPF e documento só com dígitos", () => {
    const empresa = lerEmpresa({ ...COMPLETO, EMPRESA_DOCUMENTO: "52998224725" });
    expect(empresa.documento).toBe("529.982.247-25");
    expect(empresa.tipoDoDocumento).toBe("CPF");
    expect(empresa.dadosCompletos).toBe(true);
  });

  it("aceita o WhatsApp já com o país na frente", () => {
    const empresa = lerEmpresa({ ...COMPLETO, CONTATO_WHATSAPP: "+55 66 99251-3501" });
    expect(empresa.whatsappComPais).toBe("5566992513501");
    expect(empresa.whatsapp).toBe("(66) 99251-3501");
  });

  it("marca como incompleto quando falta qualquer um dos quatro", () => {
    for (const chave of Object.keys(COMPLETO)) {
      const empresa = lerEmpresa({ ...COMPLETO, [chave]: undefined });
      expect(empresa.dadosCompletos).toBe(false);
    }
    expect(lerEmpresa({}).dadosCompletos).toBe(false);
  });

  it("trata espaço em branco como vazio", () => {
    const empresa = lerEmpresa({ ...COMPLETO, EMPRESA_NOME: "   " });
    expect(empresa.nome).toBeNull();
    expect(empresa.dadosCompletos).toBe(false);
  });

  it("não publica documento com dígito errado", () => {
    const empresa = lerEmpresa({ ...COMPLETO, EMPRESA_DOCUMENTO: "11.222.333/0001-82" });
    expect(empresa.documento).toBeNull();
    expect(empresa.tipoDoDocumento).toBeNull();
    expect(empresa.dadosCompletos).toBe(false);
  });

  it("recusa e-mail incompleto ou com caracteres que quebrariam o link", () => {
    for (const ruim of ["contato", "contato@bossa", 'a"b@bossa.com', "<a>@bossa.com"]) {
      expect(lerEmpresa({ ...COMPLETO, CONTATO_EMAIL: ruim }).email).toBeNull();
    }
  });

  it("recusa WhatsApp sem DDD", () => {
    const empresa = lerEmpresa({ ...COMPLETO, CONTATO_WHATSAPP: "99251-3501" });
    expect(empresa.whatsapp).toBeNull();
    expect(empresa.whatsappComPais).toBeNull();
    expect(empresa.dadosCompletos).toBe(false);
  });
});

describe("textos de apoio", () => {
  it("deixa o que falta visível", () => {
    expect(aPreencher("nome da empresa")).toBe("[nome da empresa — a preencher]");
  });

  it("monta o link do WhatsApp só quando há número", () => {
    const link = whatsappDoBossa("Oi, Bossa!", lerEmpresa(COMPLETO));
    expect(link).toBe("https://wa.me/5566992513501?text=Oi%2C%20Bossa!");
    expect(whatsappDoBossa("Oi", lerEmpresa({}))).toBeNull();
  });
});
