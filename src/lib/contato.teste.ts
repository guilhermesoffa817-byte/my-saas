import { afterEach, describe, expect, it, vi } from "vitest";
import { canaisDeContato } from "@/lib/contato";

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
