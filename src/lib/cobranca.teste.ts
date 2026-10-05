import { describe, expect, it } from "vitest";
import {
  LEMBRETES_PADRAO,
  lembreteDeHoje,
  momentosPendentes,
  montarMensagem,
  prazoPorExtenso,
  situacaoDaCobranca,
  type CodigoDoMomento,
} from "@/lib/cobranca";
import { deDataPura, emReais } from "@/lib/formato";

const dia = (texto: string) => deDataPura(texto)!;
const HOJE = dia("2026-10-05");

describe("situação da cobrança", () => {
  it("é atrasada só depois do vencimento", () => {
    expect(situacaoDaCobranca({ situacao: "aberta", vencimento: dia("2026-10-06") }, HOJE)).toBe("aberta");
    // No próprio dia do vencimento ainda dá tempo de pagar.
    expect(situacaoDaCobranca({ situacao: "aberta", vencimento: HOJE }, HOJE)).toBe("aberta");
    expect(situacaoDaCobranca({ situacao: "aberta", vencimento: dia("2026-10-04") }, HOJE)).toBe("atrasada");
  });

  it("paga e cancelada não viram atrasada, por mais velhas que sejam", () => {
    const velha = dia("2020-01-01");
    expect(situacaoDaCobranca({ situacao: "paga", vencimento: velha }, HOJE)).toBe("paga");
    expect(situacaoDaCobranca({ situacao: "cancelada", vencimento: velha }, HOJE)).toBe("cancelada");
  });
});

describe("prazo por extenso", () => {
  it("fala como gente", () => {
    expect(prazoPorExtenso(HOJE, HOJE)).toBe("Vence hoje");
    expect(prazoPorExtenso(dia("2026-10-06"), HOJE)).toBe("Vence amanhã");
    expect(prazoPorExtenso(dia("2026-10-08"), HOJE)).toBe("Vence em 3 dias");
    expect(prazoPorExtenso(dia("2026-10-04"), HOJE)).toBe("Venceu ontem");
    expect(prazoPorExtenso(dia("2026-09-28"), HOJE)).toBe("Venceu há 7 dias");
  });
});

describe("lembrete do dia", () => {
  const base = { preferencias: LEMBRETES_PADRAO, jaEnviados: [] as CodigoDoMomento[], hoje: HOJE };

  it("não sugere nada antes da hora", () => {
    // Vence daqui a cinco dias: o primeiro aviso é só na véspera.
    expect(lembreteDeHoje({ ...base, vencimento: dia("2026-10-10") })).toBeNull();
  });

  it("sugere na véspera", () => {
    const resultado = lembreteDeHoje({ ...base, vencimento: dia("2026-10-06") });
    expect(resultado?.momento.codigo).toBe("antes");
  });

  it("sugere no dia do vencimento", () => {
    const resultado = lembreteDeHoje({ ...base, vencimento: HOJE });
    expect(resultado?.momento.codigo).toBe("no_dia");
    // A véspera também passou sem envio, então ela é dada por coberta.
    expect(resultado?.cobre).toEqual(["antes", "no_dia"]);
  });

  it("quando vários momentos passaram, vale o mais recente e aparece uma vez só", () => {
    // Venceu há oito dias e nada foi enviado: os quatro momentos passaram.
    const resultado = lembreteDeHoje({ ...base, vencimento: dia("2026-09-27") });
    expect(resultado?.momento.codigo).toBe("sete_dias");
    expect(resultado?.cobre).toEqual(["antes", "no_dia", "tres_dias", "sete_dias"]);
  });

  it("não repete o que já foi enviado", () => {
    const resultado = lembreteDeHoje({
      ...base,
      vencimento: HOJE,
      jaEnviados: ["antes", "no_dia"],
    });
    expect(resultado).toBeNull();
  });

  it("respeita o momento desligado pelo estúdio", () => {
    const resultado = lembreteDeHoje({
      ...base,
      vencimento: HOJE,
      preferencias: { ...LEMBRETES_PADRAO, no_dia: false, antes: false },
    });
    expect(resultado).toBeNull();
  });

  it("com todos desligados, nunca sugere nada", () => {
    const resultado = lembreteDeHoje({
      ...base,
      vencimento: dia("2026-01-01"),
      preferencias: { antes: false, no_dia: false, tres_dias: false, sete_dias: false },
    });
    expect(resultado).toBeNull();
  });

  it("lista os pendentes do mais antigo para o mais novo", () => {
    const pendentes = momentosPendentes({
      vencimento: dia("2026-10-01"),
      hoje: HOJE,
      preferencias: LEMBRETES_PADRAO,
      jaEnviados: [],
    });
    expect(pendentes.map((m) => m.codigo)).toEqual(["antes", "no_dia", "tres_dias"]);
  });
});

describe("mensagem", () => {
  const dados = {
    nomeDoCliente: "Marina Alves Rodrigues",
    nomeDoEstudio: "Estúdio Bela Pele",
    valorCentavos: 12000,
    vencimento: dia("2026-10-05"),
    hoje: HOJE,
  };

  it("trata pelo primeiro nome e traz valor e data certos", () => {
    const texto = montarMensagem({ ...dados, tom: "gentil" });
    expect(texto).toContain("Oi, Marina!");
    // emReais usa o espaço fino do português, não o espaço comum: compara com
    // o próprio formatador, para o teste não travar num caractere invisível.
    expect(texto).toContain(emReais(12000));
    expect(texto).toContain("05/10/2026");
    expect(texto).toContain("Estúdio Bela Pele");
  });

  it("põe o Pix no fim, em linha separada", () => {
    const texto = montarMensagem({ ...dados, tom: "gentil", codigoPix: "00020126..." });
    expect(texto.trimEnd().endsWith("00020126...")).toBe(true);
    expect(texto).toContain("\n00020126...");
  });

  it("não quebra quando o estúdio ainda não tem chave Pix", () => {
    const texto = montarMensagem({ ...dados, tom: "gentil", codigoPix: null });
    expect(texto).not.toContain("Pix");
    expect(texto.length).toBeGreaterThan(40);
  });

  it("nenhum tom ameaça, constrange ou conta a dívida para outra pessoa", () => {
    const proibidas = [
      "negativ", "spc", "serasa", "protesto", "jurídic", "juridic", "advogado",
      "cobrador", "vergonha", "devedor", "inadimplen", "processo", "polícia",
      "policia", "dívida", "divida",
    ];
    for (const tom of ["gentil", "direto", "firme"] as const) {
      const texto = montarMensagem({ ...dados, tom }).toLowerCase();
      for (const palavra of proibidas) {
        expect(texto, `tom ${tom} usa "${palavra}"`).not.toContain(palavra);
      }
    }
  });

  it("o tom gentil convida a ignorar quando já venceu, para não cobrar quem pagou", () => {
    const texto = montarMensagem({
      ...dados,
      tom: "gentil",
      vencimento: dia("2026-10-01"),
    });
    expect(texto).toContain("pode ignorar");
  });
});
