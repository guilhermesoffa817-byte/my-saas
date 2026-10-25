import { describe, expect, it } from "vitest";
import {
  chaveParaGuardar,
  chavePorExtenso,
  crc16,
  lerCamposDoPix,
  lerChavePix,
  montarPix,
  normalizarChavePix,
  semAcento,
} from "@/lib/pix";
import { pixCopiaECola } from "@/lib/assinatura";

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
    // O Banco Central guarda a chave aleatória como UUID, com os hífens.
    expect(normalizarChavePix("123e4567-e89b-12d3-a456-426614174000")).toEqual({
      chave: "123e4567-e89b-12d3-a456-426614174000",
      tipo: "aleatoria",
    });
    expect(normalizarChavePix("123E4567E89B12D3A456426614174000")).toEqual({
      chave: "123e4567-e89b-12d3-a456-426614174000",
      tipo: "aleatoria",
    });
  });

  it("lê CPF como CPF, com e sem pontuação, e nunca como telefone", () => {
    // O caso que mandava o Pix para o celular +55 52 99822-4725 de um desconhecido.
    expect(normalizarChavePix("529.982.247-25")).toEqual({ chave: "52998224725", tipo: "cpf" });
    expect(normalizarChavePix("529982247-25")).toEqual({ chave: "52998224725", tipo: "cpf" });
    // Sem pontuação: o DDD 52 não existe, então não é celular; e o CPF confere.
    expect(normalizarChavePix("52998224725")).toEqual({ chave: "52998224725", tipo: "cpf" });
    // DDD 12 existe, mas celular tem 9 depois do DDD: é CPF.
    expect(normalizarChavePix("12345678909")).toEqual({ chave: "12345678909", tipo: "cpf" });
  });

  it("onze números que não são CPF válido, mas são celular, viram telefone", () => {
    expect(normalizarChavePix("66992513501")).toEqual({ chave: "+5566992513501", tipo: "telefone" });
  });

  it("não decide no chute quando os onze números servem para CPF e para celular", () => {
    // 119.876.543-74 é um CPF válido e (11) 98765-4374 é um celular de São Paulo.
    const lida = lerChavePix("11987654374");
    expect(lida.certo).toBe(false);
    if (!lida.certo) expect(lida.motivo).toBe("ambigua");
    expect(normalizarChavePix("11987654374")).toBeNull();

    // Escrito como um ou como outro, deixa de ser dúvida.
    expect(normalizarChavePix("119.876.543-74")).toEqual({ chave: "11987654374", tipo: "cpf" });
    expect(normalizarChavePix("(11) 98765-4374")).toEqual({ chave: "+5511987654374", tipo: "telefone" });
    expect(normalizarChavePix("+55 11 98765-4374")).toEqual({ chave: "+5511987654374", tipo: "telefone" });
  });

  it("com o tipo escolhido na tela, confere a chave contra ele", () => {
    expect(normalizarChavePix("11987654374", "cpf")).toEqual({ chave: "11987654374", tipo: "cpf" });
    expect(normalizarChavePix("11987654374", "telefone")).toEqual({
      chave: "+5511987654374",
      tipo: "telefone",
    });
    // CPF com dígito verificador errado não passa nem escolhido.
    expect(lerChavePix("529.982.247-26", "cpf")).toMatchObject({ certo: false, motivo: "invalida" });
    expect(lerChavePix("529.982.247-26")).toMatchObject({ certo: false, motivo: "invalida" });
    // Celular precisa de DDD que existe.
    expect(normalizarChavePix("52998224725", "telefone")).toBeNull();
    expect(normalizarChavePix("contato@estudio.com.br", "cpf")).toBeNull();
    expect(normalizarChavePix("11.222.333/0001-81", "cnpj")).toEqual({
      chave: "11222333000181",
      tipo: "cnpj",
    });
  });

  it("guarda a chave num formato que, lido de novo, dá o mesmo tipo", () => {
    for (const [digitada, tipo] of [
      ["11987654374", "cpf"],
      ["11987654374", "telefone"],
      ["529.982.247-25", undefined],
      ["11222333000181", "cnpj"],
      ["Contato@Estudio.com.br", undefined],
      ["123e4567e89b12d3a456426614174000", undefined],
    ] as const) {
      const lida = normalizarChavePix(digitada, tipo);
      expect(lida).not.toBeNull();
      const guardada = chaveParaGuardar(lida!);
      expect(normalizarChavePix(guardada)).toEqual(lida);
    }
    expect(chaveParaGuardar({ chave: "52998224725", tipo: "cpf" })).toBe("529.982.247-25");
  });

  it("diz em palavras o que entendeu", () => {
    expect(chavePorExtenso({ chave: "52998224725", tipo: "cpf" })).toBe("CPF 529.982.247-25");
    expect(chavePorExtenso({ chave: "+5566992513501", tipo: "telefone" })).toBe(
      "Celular +55 66 99251-3501",
    );
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

  it("põe o CPF na conta do Pix, e não um telefone", () => {
    const pix = montarPix({ ...BASE, chave: "529.982.247-25", valorCentavos: 7000 });
    if (!pix.certo) throw new Error(pix.motivo);
    const conta = lerCamposDoPix(lerCamposDoPix(pix.codigo)["26"]);
    expect(conta["00"]).toBe("br.gov.bcb.pix");
    expect(conta["01"]).toBe("52998224725");
    expect(lerCamposDoPix(pix.codigo)["54"]).toBe("70.00");
  });

  it("chave ambígua não gera código: pede para escolher o tipo", () => {
    const pix = montarPix({ ...BASE, chave: "11987654374" });
    expect(pix.certo).toBe(false);
    if (!pix.certo) expect(pix.motivo).toMatch(/CPF ou um celular/);
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

describe("Pix da mensalidade do Bossa (mesma geração)", () => {
  function chaveDaConta(codigo: string) {
    return lerCamposDoPix(lerCamposDoPix(codigo)["26"])["01"];
  }

  it("com chave CPF, o código leva o CPF", () => {
    const codigo = pixCopiaECola({ chave: "529.982.247-25", nome: "Bossa Teste", valorCentavos: 18900 });
    expect(codigo).not.toBe("");
    expect(chaveDaConta(codigo)).toBe("52998224725");
    expect(lerCamposDoPix(codigo)["54"]).toBe("189.00");
    expect(crc16(codigo.slice(0, -4))).toBe(codigo.slice(-4));
  });

  it("com chave e-mail, o código leva o e-mail", () => {
    const codigo = pixCopiaECola({
      chave: "Contato@Bossa-Teste.com.br",
      nome: "Bossa Teste",
      valorCentavos: 256900,
    });
    expect(chaveDaConta(codigo)).toBe("contato@bossa-teste.com.br");
    expect(lerCamposDoPix(codigo)["54"]).toBe("2569.00");
  });

  it("com chave ambígua, não gera código nenhum", () => {
    expect(pixCopiaECola({ chave: "11987654374", nome: "Bossa Teste", valorCentavos: 18900 })).toBe("");
  });
});
