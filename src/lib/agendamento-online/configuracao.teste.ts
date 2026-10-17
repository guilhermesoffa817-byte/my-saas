import { describe, expect, it } from "vitest";
import { lerFaixas, linkValido, sugerirLink, telefoneNacional } from "./configuracao";

describe("endereço do link", () => {
  it("aceita letras sem acento, números e hífen no meio, de 3 a 40", () => {
    expect(linkValido("estudio-bela-pele")).toBe(true);
    expect(linkValido("ana2")).toBe(true);
    expect(linkValido("ab")).toBe(false);
    expect(linkValido("a".repeat(41))).toBe(false);
    expect(linkValido("Estudio")).toBe(false);
    expect(linkValido("estúdio")).toBe(false);
    expect(linkValido("-estudio")).toBe(false);
    expect(linkValido("estudio-")).toBe(false);
    expect(linkValido("estudio--bela")).toBe(false);
    expect(linkValido("estudio/bela")).toBe(false);
  });

  it("sugere o endereço a partir do nome do negócio", () => {
    expect(sugerirLink("Estúdio Bela Pele")).toBe("estudio-bela-pele");
    expect(sugerirLink("  Barbearia do Zé & Filhos!  ")).toBe("barbearia-do-ze-filhos");
    expect(sugerirLink("Zé")).toBe("agenda-ze");
    expect(sugerirLink("")).toBe("agenda-estudio");
    const longo = sugerirLink("Clínica de Estética Avançada e Bem-Estar da Serra Gaúcha");
    expect(longo.length).toBeLessThanOrEqual(40);
    expect(linkValido(longo)).toBe(true);
  });
});

describe("horários de atendimento", () => {
  it("lê um ou mais intervalos por dia", () => {
    const lido = lerFaixas(["1|09:00|12:00", "1|13:00|18:00", "6|08:00|24:00"]);
    expect(lido).toEqual({
      faixas: [
        { diaDaSemana: 1, inicioMin: 540, fimMin: 720 },
        { diaDaSemana: 1, inicioMin: 780, fimMin: 1080 },
        { diaDaSemana: 6, inicioMin: 480, fimMin: 1440 },
      ],
    });
  });

  it("recusa horário invertido e intervalos que se cruzam", () => {
    expect(lerFaixas(["2|12:00|09:00"])).toHaveProperty("erro");
    expect(lerFaixas(["2|09:00|12:00", "2|11:00|14:00"])).toEqual({
      erro: "Terça: os intervalos 09:00–12:00 e 11:00–14:00 se cruzam.",
    });
    expect(lerFaixas(["7|09:00|12:00"])).toHaveProperty("erro");
    expect(lerFaixas(["1|9h|12:00"])).toHaveProperty("erro");
  });

  it("23:59 no fim vale como meia-noite", () => {
    expect(lerFaixas(["5|18:00|23:59"])).toEqual({ faixas: [{ diaDaSemana: 5, inicioMin: 1080, fimMin: 1440 }] });
  });

  it("intervalos colados não se cruzam", () => {
    expect(lerFaixas(["3|09:00|12:00", "3|12:00|15:00"])).not.toHaveProperty("erro");
  });
});

describe("WhatsApp de quem marca", () => {
  it("fica só com DDD e número, com ou sem o 55", () => {
    expect(telefoneNacional("(66) 99251-3501")).toBe("66992513501");
    expect(telefoneNacional("+55 66 99251-3501")).toBe("66992513501");
    expect(telefoneNacional("6632513501")).toBe("6632513501");
    // 55 também é DDD (Caxias do Sul): 11 dígitos não perdem o começo.
    expect(telefoneNacional("55999998888")).toBe("55999998888");
  });

  it("recusa número curto, longo ou com zero na frente", () => {
    expect(telefoneNacional("99251-3501")).toBeNull();
    expect(telefoneNacional("0 66 99251-3501")).toBeNull();
    expect(telefoneNacional("123456789012345")).toBeNull();
    expect(telefoneNacional("")).toBeNull();
  });
});
