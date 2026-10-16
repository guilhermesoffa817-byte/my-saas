import { describe, expect, it } from "vitest";
import type { DespesaParaCusto } from "./calculo";
import {
  motivoDoQueSobrou,
  planejarSugestao,
  precisaDeSugestao,
  resumoDaSugestao,
  textoDasPendentes,
} from "./sugestao";

let sequencia = 0;
function despesa(dados: Partial<DespesaParaCusto> = {}): DespesaParaCusto {
  sequencia += 1;
  return {
    id: `d${sequencia}`,
    descricao: "Lavanderia",
    categoria: null,
    valorCentavos: 10_000,
    mes: "2026-10",
    dia: "2026-10-10",
    natureza: null,
    origem: null,
    motivo: null,
    daEquipe: false,
    ...dados,
  };
}

describe("planejarSugestao", () => {
  it("regra primeiro, o resto para a IA (maiores antes), e não toca no que já tem natureza", () => {
    const aluguel = despesa({ descricao: "Aluguel da sala" });
    const pequena = despesa({ descricao: "Lavanderia", valorCentavos: 3_000 });
    const grande = despesa({ descricao: "Curso de extensão", valorCentavos: 90_000 });
    const daDona = despesa({ descricao: "Aluguel do depósito", natureza: "variavel", origem: "voce" });
    const daIa = despesa({ descricao: "Algo", natureza: "fixo", origem: "ia" });
    const retirada = despesa({ descricao: "Retirada pessoal" });
    const outroMes = despesa({ descricao: "Internet", mes: "2026-09" });

    const plano = planejarSugestao({
      mes: "2026-10",
      despesas: [aluguel, pequena, grande, daDona, daIa, retirada, outroMes],
    });

    expect(plano.porRegra).toEqual([
      { id: aluguel.id, natureza: "fixo", motivo: "Aluguel se paga todo mês, com ou sem atendimento." },
    ]);
    expect(plano.paraIa.map((d) => d.id)).toEqual([grande.id, pequena.id]);
  });

  it("retirada e despesa já classificada não precisam de sugestão", () => {
    expect(precisaDeSugestao(despesa())).toBe(true);
    expect(precisaDeSugestao(despesa({ natureza: "fixo", origem: "voce" }))).toBe(false);
    expect(precisaDeSugestao(despesa({ descricao: "Pró-labore" }))).toBe(false);
  });
});

describe("motivoDoQueSobrou", () => {
  it("explica por que sobrou despesa", () => {
    expect(motivoDoQueSobrou({ erroDaIa: "x", enviados: 0, total: 3, limitadoPelaFranquia: false })).toBe("erro");
    expect(motivoDoQueSobrou({ erroDaIa: null, enviados: 2, total: 3, limitadoPelaFranquia: true })).toBe("franquia");
    expect(motivoDoQueSobrou({ erroDaIa: null, enviados: 2, total: 3, limitadoPelaFranquia: false })).toBe(
      "proxima_rodada",
    );
    expect(
      motivoDoQueSobrou({ erroDaIa: null, enviados: 3, total: 3, limitadoPelaFranquia: false, interrompido: true }),
    ).toBe("proxima_rodada");
  });
});

describe("frases", () => {
  it("resume o que aconteceu", () => {
    expect(resumoDaSugestao({ porRegra: 0, porIa: 0, semIa: 0, motivoSemIa: null })).toBe(
      "Nenhuma despesa nova para classificar.",
    );
    expect(resumoDaSugestao({ porRegra: 2, porIa: 1, semIa: 0, motivoSemIa: null })).toBe(
      "2 despesas classificadas por regra e 1 sugestão da IA.",
    );
    expect(resumoDaSugestao({ porRegra: 1, porIa: 0, semIa: 3, motivoSemIa: "nao_configurada" })).toMatch(
      /^1 despesa classificada por regra\. 3 despesas ficaram sem classificação: a IA não está ligada/,
    );
    expect(resumoDaSugestao({ porRegra: 0, porIa: 0, semIa: 1, motivoSemIa: "franquia" })).toBe(
      "1 despesa ficou sem classificação: a franquia de IA do mês acabou.",
    );
    expect(resumoDaSugestao({ porRegra: 0, porIa: 4, semIa: 0, motivoSemIa: null, recusadas: 1 })).toBe(
      "4 sugestões da IA. A IA não sugeriu nada para 1 despesa: classifique na lista.",
    );
  });

  it("conta as pendentes", () => {
    expect(textoDasPendentes({ total: 0, pendentes: 0 })).toBe("Nenhuma despesa neste mês para classificar.");
    expect(textoDasPendentes({ total: 4, pendentes: 0 })).toBe("Todas as despesas do mês já estão classificadas.");
    expect(textoDasPendentes({ total: 4, pendentes: 1 })).toBe("1 despesa sem classificação.");
    expect(textoDasPendentes({ total: 4, pendentes: 3 })).toBe("3 despesas sem classificação.");
  });
});
