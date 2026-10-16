import { describe, expect, it } from "vitest";
import {
  ITENS_DO_COMPLETO,
  ITENS_DO_SIMPLES,
  TUDO_DO_SIMPLES,
  textosDoPlano,
} from "@/lib/itens-dos-planos";
import {
  LEITURAS_POR_MES_NO_COMPLETO,
  PERGUNTAS_POR_MES_NO_COMPLETO,
  RECURSOS,
  soNoCompleto,
} from "@/lib/recursos";

describe("o que cada plano promete", () => {
  it("não promete no Simples nada que só o Completo libera", () => {
    for (const item of ITENS_DO_SIMPLES) {
      for (const recurso of item.recursos) {
        expect(soNoCompleto(recurso), `${item.texto} depende de ${recurso}`).toBe(false);
      }
    }
  });

  it("não fala, no Simples, de função do Completo nem pelo nome", () => {
    const simples = textosDoPlano("simples").join(" ");
    expect(simples).not.toMatch(/lembrete|contas a pagar|documento|custos|relat[óo]rio|contador|equipe|assistente/i);
  });

  it("lista no Completo só o que é do Completo", () => {
    for (const item of ITENS_DO_COMPLETO) {
      expect(item.recursos.length, item.texto).toBeGreaterThan(0);
      for (const recurso of item.recursos) {
        expect(soNoCompleto(recurso), `${item.texto} depende de ${recurso}`).toBe(true);
      }
    }
  });

  it("mostra todo recurso do Completo em alguma linha do Completo", () => {
    const anunciados = new Set(ITENS_DO_COMPLETO.flatMap((item) => item.recursos));
    for (const recurso of RECURSOS.filter(soNoCompleto)) {
      expect(anunciados.has(recurso), recurso).toBe(true);
    }
  });

  it("mostra Finanças no Simples, que agora é dele", () => {
    const anunciados = new Set(ITENS_DO_SIMPLES.flatMap((item) => item.recursos));
    expect(anunciados.has("financas")).toBe(true);
    expect(anunciados.has("cobrar")).toBe(true);
  });

  it("usa as franquias de verdade, não um número escrito à mão", () => {
    const completo = textosDoPlano("completo").join(" ");
    expect(completo).toContain(`até ${LEITURAS_POR_MES_NO_COMPLETO} por mês`);
    expect(completo).toContain(`até ${PERGUNTAS_POR_MES_NO_COMPLETO} perguntas por mês`);
  });

  it("abre a lista do Completo com o Simples e não repete linha", () => {
    const completo = textosDoPlano("completo");
    expect(completo[0]).toBe(TUDO_DO_SIMPLES);
    const todos = [...textosDoPlano("simples"), ...completo];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("não promete o que o Bossa não faz", () => {
    const tudo = [...textosDoPlano("simples"), ...textosDoPlano("completo")].join(" ");
    expect(tudo).not.toMatch(/garant|aumenta|folha de pagamento|eSocial|substitui/i);
  });
});
