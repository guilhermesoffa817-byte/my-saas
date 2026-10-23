import { afterEach, describe, expect, it, vi } from "vitest";
import { canaisDeContato, canaisPorExtenso, dadosDoResponsavel } from "@/lib/contato";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canais de contato", () => {
  it("sem nada preenchido, não inventa canal", () => {
    vi.stubEnv("CONTATO_EMAIL", "");
    vi.stubEnv("CONTATO_WHATSAPP", "");
    expect(canaisDeContato()).toEqual([]);
  });

  it("monta e-mail e WhatsApp com país", () => {
    vi.stubEnv("CONTATO_EMAIL", "contato@bossa.com.br");
    vi.stubEnv("CONTATO_WHATSAPP", "(66) 99251-3501");
    expect(canaisDeContato()).toEqual([
      { tipo: "email", rotulo: "contato@bossa.com.br", href: "mailto:contato@bossa.com.br" },
      { tipo: "whatsapp", rotulo: "(66) 99251-3501", href: "https://wa.me/5566992513501" },
    ]);
  });

  it("ignora e-mail inválido e telefone sem DDD", () => {
    vi.stubEnv("CONTATO_EMAIL", "[PREENCHER]");
    vi.stubEnv("CONTATO_WHATSAPP", "99251");
    expect(canaisDeContato()).toEqual([]);
  });
});

describe("canais por extenso", () => {
  it("escreve os dois canais numa frase", () => {
    vi.stubEnv("CONTATO_EMAIL", "contato@bossa.com.br");
    vi.stubEnv("CONTATO_WHATSAPP", "(66) 99251-3501");
    expect(canaisPorExtenso()).toBe("pelo e-mail contato@bossa.com.br ou pelo WhatsApp (66) 99251-3501");
  });

  it("sem canal, fica vazio", () => {
    vi.stubEnv("CONTATO_EMAIL", "");
    vi.stubEnv("CONTATO_WHATSAPP", "");
    expect(canaisPorExtenso()).toBe("");
  });
});

describe("dados do responsável", () => {
  it("sem nada preenchido, devolve vazio em vez de um aviso entre colchetes", () => {
    vi.stubEnv("RESPONSAVEL_NOME", "");
    vi.stubEnv("RESPONSAVEL_DOCUMENTO", "   ");
    vi.stubEnv("ENCARREGADO_DE_DADOS", "");
    expect(dadosDoResponsavel()).toEqual({ nome: null, documento: null, encarregado: null });
  });

  it("lê o ambiente na hora e tira os espaços", () => {
    vi.stubEnv("RESPONSAVEL_NOME", "  Marina Albuquerque Serviços Digitais Ltda. ");
    vi.stubEnv("RESPONSAVEL_DOCUMENTO", "12.345.678/0001-90");
    vi.stubEnv("ENCARREGADO_DE_DADOS", "Marina Albuquerque");
    expect(dadosDoResponsavel()).toEqual({
      nome: "Marina Albuquerque Serviços Digitais Ltda.",
      documento: "12.345.678/0001-90",
      encarregado: "Marina Albuquerque",
    });
  });
});
