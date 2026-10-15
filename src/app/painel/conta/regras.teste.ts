import { describe, expect, it } from "vitest";
import {
  conferirDadosDaConta,
  erroDaSenhaNova,
  exclusaoConfirmada,
  mudaAPortaDeEntrada,
} from "./regras";

const certo = {
  nome: "Ana Paula",
  nomeNegocio: "Estúdio Bela Vista",
  email: "ana@belavista.com.br",
  telefone: "(66) 99251-3501",
  // Um CPF de exemplo com os dígitos verificadores certos.
  documento: "529.982.247-25",
  cep: "78000-000",
  endereco: "Rua das Flores, 120",
};

function erroDe(mudanca: Partial<typeof certo>) {
  const resultado = conferirDadosDaConta({ ...certo, ...mudanca });
  return resultado.certo ? null : resultado.erro;
}

describe("dados da conta", () => {
  it("aceita um cadastro completo e devolve os valores limpos", () => {
    const resultado = conferirDadosDaConta({
      ...certo,
      email: "  Ana@BelaVista.com.br ",
    });
    expect(resultado).toEqual({
      certo: true,
      valores: {
        nome: "Ana Paula",
        nomeNegocio: "Estúdio Bela Vista",
        email: "ana@belavista.com.br",
        telefone: "(66) 99251-3501",
        documento: "52998224725",
        cep: "78000000",
        endereco: "Rua das Flores, 120",
      },
    });
  });

  it("CEP e endereço podem ficar vazios", () => {
    const resultado = conferirDadosDaConta({ ...certo, cep: "", endereco: "  " });
    expect(resultado.certo && resultado.valores.cep).toBeNull();
    expect(resultado.certo && resultado.valores.endereco).toBeNull();
  });

  it("pede os campos obrigatórios", () => {
    for (const campo of [
      "nome",
      "nomeNegocio",
      "email",
      "telefone",
      "documento",
    ] as const) {
      expect(erroDe({ [campo]: "   " })).toContain("falta preencher");
    }
  });

  it("recusa e-mail incompleto", () => {
    expect(erroDe({ email: "ana@belavista" })).toContain("e-mail");
    expect(erroDe({ email: "ana belavista.com" })).toContain("e-mail");
  });

  it("recusa WhatsApp sem DDD", () => {
    expect(erroDe({ telefone: "99251-3501" })).toContain("DDD");
  });

  it("recusa CPF ou CNPJ que não confere", () => {
    expect(erroDe({ documento: "111.111.111-11" })).toContain("CPF ou CNPJ");
    expect(erroDe({ documento: "529.982.247-24" })).toContain("CPF ou CNPJ");
  });

  it("aceita CNPJ", () => {
    expect(erroDe({ documento: "11.222.333/0001-81" })).toBeNull();
  });

  it("recusa CEP que não tem 8 números", () => {
    expect(erroDe({ cep: "7800" })).toContain("CEP");
  });

  it("recusa nome do estúdio comprido demais para caber numa cobrança", () => {
    expect(erroDe({ nomeNegocio: "a".repeat(81) })).toContain("80");
    expect(erroDe({ nomeNegocio: "a".repeat(80) })).toBeNull();
  });
});

describe("porta de entrada", () => {
  const atual = { email: "ana@belavista.com.br", telefone: "(66) 99251-3501" };

  it("mudar o e-mail ou o WhatsApp muda a porta", () => {
    expect(
      mudaAPortaDeEntrada(atual, { ...atual, email: "outra@belavista.com.br" }),
    ).toBe(true);
    expect(mudaAPortaDeEntrada(atual, { ...atual, telefone: "(66) 99999-0000" })).toBe(
      true,
    );
  });

  it("escrever o mesmo número com outra máscara não muda nada", () => {
    expect(mudaAPortaDeEntrada(atual, { ...atual, telefone: "66992513501" })).toBe(false);
    expect(mudaAPortaDeEntrada(atual, { ...atual, email: " ANA@belavista.com.br" })).toBe(
      false,
    );
  });

  it("quem não tinha WhatsApp e passa a ter também confirma", () => {
    expect(mudaAPortaDeEntrada({ ...atual, telefone: null }, atual)).toBe(true);
  });
});

describe("senha nova", () => {
  it("passa quando está tudo certo", () => {
    expect(
      erroDaSenhaNova({ atual: "antiga123", nova: "novinha123", repetida: "novinha123" }),
    ).toBeNull();
  });

  it("pede a senha atual", () => {
    expect(
      erroDaSenhaNova({ atual: "", nova: "novinha123", repetida: "novinha123" }),
    ).toContain("atual");
  });

  it("pede pelo menos 8 caracteres", () => {
    expect(
      erroDaSenhaNova({ atual: "antiga123", nova: "curta", repetida: "curta" }),
    ).toContain("8");
  });

  it("as duas senhas novas precisam bater", () => {
    expect(
      erroDaSenhaNova({ atual: "antiga123", nova: "novinha123", repetida: "novinha124" }),
    ).toContain("iguais");
  });

  it("a nova precisa ser diferente da atual", () => {
    expect(
      erroDaSenhaNova({ atual: "mesma1234", nova: "mesma1234", repetida: "mesma1234" }),
    ).toContain("diferente");
  });
});

describe("confirmação de exclusão", () => {
  it("aceita EXCLUIR, mesmo com a primeira letra que o teclado põe maiúscula", () => {
    expect(exclusaoConfirmada("EXCLUIR")).toBe(true);
    expect(exclusaoConfirmada("Excluir ")).toBe(true);
  });

  it("recusa qualquer outra coisa", () => {
    expect(exclusaoConfirmada("")).toBe(false);
    expect(exclusaoConfirmada("sim")).toBe(false);
    expect(exclusaoConfirmada("EXCLUI")).toBe(false);
  });
});
