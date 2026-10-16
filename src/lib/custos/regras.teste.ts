import { describe, expect, it } from "vitest";
import {
  classificarPorRegra,
  ehRetirada,
  motivoParaGravar,
  naturezaDoPagamentoDaEquipe,
  normalizar,
} from "./regras";

const natureza = (descricao: string, categoria?: string | null) =>
  classificarPorRegra({ descricao, categoria })?.natureza ?? null;

describe("classificarPorRegra", () => {
  it.each([
    "Aluguel da sala 204 — outubro",
    "Condomínio do edifício",
    "Internet fibra 500 MB",
    "Conta de luz — Energisa",
    "Conta de água",
    "Telefone fixo",
    "Honorários da contadora",
    "Mensalidade do sistema de agenda",
    "Assinatura do Canva",
    "Seguro do salão",
    "Salário da recepcionista",
    "Tarifa bancária de manutenção",
  ])("fixo: %s", (descricao) => {
    expect(natureza(descricao)).toBe("fixo");
  });

  it.each([
    "Compra de produtos para coloração",
    "Material descartável (luvas e toucas)",
    "Comissão da Juliana — outubro",
    "Cota-parte do salão-parceiro",
    "Repasse ao profissional parceiro",
    "Taxa da maquininha",
    "Taxa de cartão de crédito",
    "DAS de outubro",
    "ISS do mês",
    "Frete da distribuidora",
  ])("variável: %s", (descricao) => {
    expect(natureza(descricao)).toBe("variavel");
  });

  it.each([
    "Juros do cheque especial",
    "Multa por atraso no boleto",
    "Parcela do empréstimo",
    "Compra de equipamento — cadeira de barbeiro",
    "Carnê-Leão de setembro",
  ])("fora da operação: %s", (descricao) => {
    expect(natureza(descricao)).toBe("nao_operacional");
  });

  it("Carnê-Leão fica fora da operação e pede para confirmar com o contador", () => {
    const resultado = classificarPorRegra({ descricao: "Carne Leao" });
    expect(resultado?.natureza).toBe("nao_operacional");
    expect(resultado?.motivo).toMatch(/confirme com seu contador/);
  });

  it("juros do cartão são financeiros, não taxa de cartão", () => {
    expect(natureza("Juros do cartão de crédito")).toBe("nao_operacional");
  });

  it("'das' minúsculo é contração, não o imposto", () => {
    expect(natureza("Limpeza das janelas")).toBeNull();
  });

  it("usa a categoria quando a descrição não diz nada", () => {
    expect(natureza("Pagamento avulso", "Aluguel")).toBe("fixo");
    expect(natureza("Pagamento avulso", "Outros")).toBeNull();
    expect(natureza("Pagamento avulso", null)).toBeNull();
  });

  it("categorias da Equipe caem na natureza certa", () => {
    expect(natureza("Bônus — Juliana P.", "Salários e encargos")).toBe("fixo");
    expect(natureza("Adiantamento — Rafael L.", "Comissões e repasses")).toBe("variavel");
  });

  it("categoria que mistura naturezas não decide sozinha", () => {
    const impostos = "Impostos (DAS, ISS, Carnê-Leão)";
    expect(natureza("Carnê-Leão set/2026", impostos)).toBe("nao_operacional");
    expect(natureza("DAS de setembro", impostos)).toBe("variavel");
    expect(natureza("Guia de setembro", impostos)).toBeNull();
  });

  it("não casa pedaço de palavra e não inventa com texto vazio", () => {
    expect(natureza("Lavagem de toalhas")).toBeNull();
    expect(natureza("Materialidade")).toBeNull();
    expect(classificarPorRegra({ descricao: "   ", categoria: "  " })).toBeNull();
  });
});

describe("retirada da dona", () => {
  it.each(["Retirada pessoal", "Retirada do dono", "retirada da dona", "Pró-labore de outubro", "Pro labore", "Retirada"])(
    "fica fora da análise: %s",
    (descricao) => {
      expect(ehRetirada({ descricao, categoria: null })).toBe(true);
    },
  );

  it("vale também pela categoria", () => {
    expect(ehRetirada({ descricao: "Pix de outubro", categoria: "Retirada" })).toBe(true);
  });

  it("não confunde serviço com retirada de dinheiro", () => {
    expect(ehRetirada({ descricao: "Retirada de lixo", categoria: null })).toBe(false);
    expect(ehRetirada({ descricao: "Aluguel", categoria: "Fixas" })).toBe(false);
  });
});

describe("pagamentos da Equipe", () => {
  it("comissão, cota-parte e repasse nascem variáveis; salário e bolsa, fixos", () => {
    expect(naturezaDoPagamentoDaEquipe("comissao")?.natureza).toBe("variavel");
    expect(naturezaDoPagamentoDaEquipe("cota_parte")?.natureza).toBe("variavel");
    expect(naturezaDoPagamentoDaEquipe("repasse")?.natureza).toBe("variavel");
    expect(naturezaDoPagamentoDaEquipe("salario")?.natureza).toBe("fixo");
    expect(naturezaDoPagamentoDaEquipe("bolsa")?.natureza).toBe("fixo");
    expect(naturezaDoPagamentoDaEquipe("bonus")).toBeNull();
  });
});

describe("textos", () => {
  it("normaliza acento, pontuação e caixa", () => {
    expect(normalizar("  Pró-Labore, Condomínio!  ")).toBe("pro labore condominio");
  });

  it("o motivo cabe na coluna", () => {
    expect(motivoParaGravar("x".repeat(300))).toHaveLength(200);
    expect(motivoParaGravar("  Aluguel   se paga  ")).toBe("Aluguel se paga");
  });
});
