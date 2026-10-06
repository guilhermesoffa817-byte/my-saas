import { describe, expect, it } from "vitest";
import {
  crc16,
  lerCamposDoPix,
  montarPix,
  normalizarChavePix,
  semAcento,
} from "@/lib/pix";

const BASE = {
  chave: "+5566992513501",
  nome: "Estúdio Bela Pele",
  cidade: "Cuiabá",
  valorCentavos: 12000,
};

describe("chave Pix", () => {
  it("reconhece telefone com e sem o país", () => {
    expect(normalizarChavePix("+5566992513501")).toEqual({
      chave: "+5566992513501",
      tipo: "telefone",
    });
    expect(normalizarChavePix("(66) 99251-3501")).toEqual({
      chave: "+5566992513501",
      tipo: "telefone",
    });
    expect(normalizarChavePix("66 3025-1234")).toEqual({
      chave: "+556630251234",
      tipo: "telefone",
    });
  });

  it("não confunde o DDD 55 com o código do país", () => {
    expect(normalizarChavePix("(55) 99999-8888")).toEqual({
      chave: "+5555999998888",
      tipo: "telefone",
    });
  });

  it("reconhece e-mail, CNPJ e chave aleatória", () => {
    expect(normalizarChavePix("Contato@Estudio.com.br")).toEqual({
      chave: "contato@estudio.com.br",
      tipo: "email",
    });
    expect(normalizarChavePix("11.222.333/0001-81")).toEqual({
      chave: "11222333000181",
      tipo: "cnpj",
    });
    expect(normalizarChavePix("123e4567-e89b-12d3-a456-426614174000")).toEqual({
      chave: "123e4567e89b12d3a456426614174000",
      tipo: "aleatoria",
    });
  });

  it("recusa o que não é chave", () => {
    for (const ruim of ["", "   ", "abc", "1234", "sem-arroba.com"]) {
      expect(normalizarChavePix(ruim)).toBeNull();
    }
  });
});

describe("texto sem acento", () => {
  it("tira acento, cedilha e pontuação", () => {
    expect(semAcento("Estúdio Bela Pele")).toBe("ESTUDIO BELA PELE");
    expect(semAcento("Cuiabá")).toBe("CUIABA");
    expect(semAcento("Açaí & Cia.")).toBe("ACAI CIA");
  });
});

describe("código Pix", () => {
  it("monta um código com todos os campos obrigatórios", () => {
    const pix = montarPix(BASE);
    expect(pix.certo).toBe(true);
    if (!pix.certo) return;

    const campos = lerCamposDoPix(pix.codigo);
    expect(campos["00"]).toBe("01");
    expect(campos["52"]).toBe("0000");
    expect(campos["53"]).toBe("986");
    expect(campos["54"]).toBe("120.00");
    expect(campos["58"]).toBe("BR");
    expect(campos["59"]).toBe("ESTUDIO BELA PELE");
    expect(campos["60"]).toBe("CUIABA");
    expect(campos["26"]).toContain("br.gov.bcb.pix");
    expect(campos["26"]).toContain("+5566992513501");
  });

  it("fecha com um CRC16 que confere", () => {
    const pix = montarPix(BASE);
    if (!pix.certo) throw new Error("não montou");

    const semOCrc = pix.codigo.slice(0, -4);
    const crcDoCodigo = pix.codigo.slice(-4);
    expect(crc16(semOCrc)).toBe(crcDoCodigo);
    expect(crcDoCodigo).toMatch(/^[0-9A-F]{4}$/);
  });

  it("usa o padrão conhecido do CRC16-CCITT", () => {
    // Valor de referência do algoritmo, para pegar uma troca de polinômio.
    expect(crc16("123456789")).toBe("29B1");
  });

  it("escreve o valor com ponto e duas casas", () => {
    for (const [centavos, esperado] of [
      [100, "1.00"],
      [12050, "120.50"],
      [999, "9.99"],
      [1, "0.01"],
    ] as const) {
      const pix = montarPix({ ...BASE, valorCentavos: centavos });
      if (!pix.certo) throw new Error("não montou");
      expect(lerCamposDoPix(pix.codigo)["54"]).toBe(esperado);
    }
  });

  it("corta nome e cidade no limite do padrão", () => {
    const pix = montarPix({
      ...BASE,
      nome: "Estúdio de Estética e Beleza da Dona Marina Alves Rodrigues",
      cidade: "São José do Rio Preto do Oeste",
    });
    if (!pix.certo) throw new Error("não montou");
    const campos = lerCamposDoPix(pix.codigo);
    expect(campos["59"].length).toBeLessThanOrEqual(25);
    expect(campos["60"].length).toBeLessThanOrEqual(15);
  });

  it("deixa o identificador só com letras e números", () => {
    const pix = montarPix({ ...BASE, identificador: "Cobrança #12/2026" });
    if (!pix.certo) throw new Error("não montou");
    expect(lerCamposDoPix(pix.codigo)["62"]).toBe("0514COBRANCA122026");
  });

  it("recusa valor zerado, negativo ou quebrado", () => {
    for (const valor of [0, -1, 1.5, Number.NaN]) {
      expect(montarPix({ ...BASE, valorCentavos: valor }).certo).toBe(false);
    }
  });

  it("recusa chave que não reconhece, em vez de gerar código quebrado", () => {
    expect(montarPix({ ...BASE, chave: "sei la" }).certo).toBe(false);
  });

  it("cada campo declara o próprio tamanho corretamente", () => {
    const pix = montarPix(BASE);
    if (!pix.certo) throw new Error("não montou");

    // Se algum tamanho estivesse errado, a leitura sairia do trilho e o último
    // campo não seria o CRC.
    const campos = lerCamposDoPix(pix.codigo);
    expect(campos["63"]).toBe(pix.codigo.slice(-4));
  });
});
