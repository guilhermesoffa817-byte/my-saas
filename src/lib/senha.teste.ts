import { describe, expect, it } from "vitest";
import {
  MINUTOS_DE_VALIDADE,
  codigoConfere,
  gerarCodigo,
  linkDaNovaSenha,
  mensagemDaNovaSenha,
  pedidoValido,
  resumoDoCodigo,
  validadeAPartirDe,
} from "@/lib/senha";

describe("código de recuperação", () => {
  it("nunca repete", () => {
    const vistos = new Set(Array.from({ length: 500 }, () => gerarCodigo()));
    expect(vistos.size).toBe(500);
  });

  it("é longo e sem caractere que quebre endereço", () => {
    const codigo = gerarCodigo();
    expect(codigo.length).toBeGreaterThanOrEqual(43);
    expect(codigo).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(codigo)).toBe(codigo);
  });

  it("o resumo não deixa voltar ao código", () => {
    const codigo = gerarCodigo();
    const resumo = resumoDoCodigo(codigo);
    expect(resumo).toHaveLength(64);
    expect(resumo).not.toContain(codigo);
    expect(resumo).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o mesmo código dá sempre o mesmo resumo, e outro código dá outro", () => {
    const a = gerarCodigo();
    const b = gerarCodigo();
    expect(resumoDoCodigo(a)).toBe(resumoDoCodigo(a));
    expect(resumoDoCodigo(a)).not.toBe(resumoDoCodigo(b));
  });

  it("confere o código certo e recusa o errado", () => {
    const codigo = gerarCodigo();
    const resumo = resumoDoCodigo(codigo);

    expect(codigoConfere(codigo, resumo)).toBe(true);
    expect(codigoConfere(gerarCodigo(), resumo)).toBe(false);
    expect(codigoConfere("", resumo)).toBe(false);
    expect(codigoConfere(codigo + "a", resumo)).toBe(false);
  });

  it("não quebra com resumo estragado no banco", () => {
    const codigo = gerarCodigo();
    for (const ruim of ["", "nao-e-hexadecimal", "abc", "z".repeat(64)]) {
      expect(codigoConfere(codigo, ruim)).toBe(false);
    }
  });
});

describe("validade do pedido", () => {
  const agora = new Date("2026-10-06T12:00:00.000Z");

  it("vale por meia hora", () => {
    const expira = validadeAPartirDe(agora);
    expect(expira.getTime() - agora.getTime()).toBe(MINUTOS_DE_VALIDADE * 60 * 1000);
  });

  it("aceita dentro do prazo e recusa depois", () => {
    expect(pedidoValido({ expiraEm: validadeAPartirDe(agora), usadoEm: null }, agora)).toBe(true);
    expect(
      pedidoValido(
        { expiraEm: new Date(agora.getTime() + 1000), usadoEm: null },
        agora,
      ),
    ).toBe(true);
    expect(
      pedidoValido({ expiraEm: new Date(agora.getTime() - 1), usadoEm: null }, agora),
    ).toBe(false);
  });

  it("recusa código já usado, mesmo dentro do prazo", () => {
    expect(
      pedidoValido(
        { expiraEm: validadeAPartirDe(agora), usadoEm: new Date(agora.getTime() - 60000) },
        agora,
      ),
    ).toBe(false);
  });

  it("recusa pedido que não existe", () => {
    expect(pedidoValido(null, agora)).toBe(false);
    expect(pedidoValido(undefined, agora)).toBe(false);
  });
});

describe("link e mensagem", () => {
  it("monta o endereço sem barra dobrada", () => {
    expect(linkDaNovaSenha("https://bossa.com.br/", "abc")).toBe(
      "https://bossa.com.br/nova-senha/abc",
    );
    expect(linkDaNovaSenha("https://bossa.com.br", "abc")).toBe(
      "https://bossa.com.br/nova-senha/abc",
    );
  });

  it("trata pelo primeiro nome e avisa do prazo", () => {
    const texto = mensagemDaNovaSenha({
      nome: "Rafaela Niehues da Silva",
      link: "https://bossa.com.br/nova-senha/abc",
    });
    expect(texto).toContain("Oi, Rafaela!");
    expect(texto).toContain("https://bossa.com.br/nova-senha/abc");
    expect(texto).toContain(`${MINUTOS_DE_VALIDADE} minutos`);
    expect(texto).toContain("pode ignorar");
  });
});
