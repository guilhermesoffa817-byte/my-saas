import { describe, expect, it } from "vitest";
import {
  PLANOS,
  RECADO_DA_DEMONSTRACAO,
  avaliarAssinatura,
  economiaDoAnual,
  mensalDoAnual,
  planoPorCodigo,
  temPlanoCompleto,
} from "@/lib/assinatura";

const AGORA = new Date("2026-10-16T15:00:00.000Z");
const amanha = new Date("2026-10-17T15:00:00.000Z");
const ontem = new Date("2026-10-15T15:00:00.000Z");

describe("quem vê a demonstração", () => {
  it("conta nova, que nunca pagou, vê a demonstração", () => {
    const situacao = avaliarAssinatura({ status: "demonstracao", validaAte: AGORA }, AGORA);
    expect(situacao.demonstracao).toBe(true);
    expect(situacao.liberada).toBe(false);
    expect(situacao.status).toBe("demonstracao");
    expect(situacao.recado).toBe(RECADO_DA_DEMONSTRACAO);
  });

  it("quem está no teste grátis antigo continua com os próprios dados até acabar", () => {
    const situacao = avaliarAssinatura({ status: "teste", validaAte: amanha }, AGORA);
    expect(situacao.demonstracao).toBe(false);
    expect(situacao.liberada).toBe(true);
    expect(situacao.emTeste).toBe(true);
  });

  it("teste antigo que venceu vira demonstração, e não assinatura vencida", () => {
    const situacao = avaliarAssinatura({ status: "teste", validaAte: ontem }, AGORA);
    expect(situacao.demonstracao).toBe(true);
    expect(situacao.liberada).toBe(false);
  });

  it("quem já pagou e venceu NÃO cai na demonstração: vai para a assinatura com os dados guardados", () => {
    const situacao = avaliarAssinatura({ status: "ativa", validaAte: ontem }, AGORA);
    expect(situacao.demonstracao).toBe(false);
    expect(situacao.liberada).toBe(false);
    expect(situacao.status).toBe("expirada");
  });

  it("assinatura em dia usa os próprios dados", () => {
    const situacao = avaliarAssinatura({ status: "ativa", validaAte: amanha }, AGORA);
    expect(situacao.demonstracao).toBe(false);
    expect(situacao.liberada).toBe(true);
  });

  it("conta sem assinatura nenhuma é de quem nunca pagou: demonstração", () => {
    expect(avaliarAssinatura(null, AGORA).demonstracao).toBe(true);
  });
});

describe("planos e preços", () => {
  it("usa os preços novos quando o ambiente não define outros", () => {
    // O .env.teste não define preço: valem os padrões do código.
    expect(PLANOS.mensal.valorCentavos).toBe(18900);
    expect(PLANOS.anual.valorCentavos).toBe(189000);
    expect(PLANOS.vip_mensal.valorCentavos).toBe(32900);
    expect(PLANOS.vip_anual.valorCentavos).toBe(256900);
  });

  it("chama os planos de Simples e Completo, com os mesmos códigos de antes", () => {
    expect(PLANOS.mensal.nome).toBe("Simples mensal");
    expect(PLANOS.vip_anual.nome).toBe("Completo anual");
    expect(planoPorCodigo("vip_mensal").completo).toBe(true);
    expect(planoPorCodigo("anual").completo).toBe(false);
    expect(planoPorCodigo("qualquer coisa").codigo).toBe("mensal");
    expect(planoPorCodigo("toString").codigo).toBe("mensal");
  });

  it("calcula a economia do anual em vez de prometer meses de brinde", () => {
    expect(economiaDoAnual("simples")).toBe(18900 * 12 - 189000);
    expect(economiaDoAnual("completo")).toBe(32900 * 12 - 256900);
    expect(mensalDoAnual("completo")).toBe(Math.floor(256900 / 12));
  });

  it("só libera o Completo para quem pagou o Completo e está em dia", () => {
    expect(temPlanoCompleto({ status: "ativa", plano: "vip_anual", validaAte: amanha }, AGORA)).toBe(true);
    expect(temPlanoCompleto({ status: "ativa", plano: "anual", validaAte: amanha }, AGORA)).toBe(false);
    expect(temPlanoCompleto({ status: "teste", plano: "vip_anual", validaAte: amanha }, AGORA)).toBe(false);
    expect(temPlanoCompleto({ status: "ativa", plano: "vip_anual", validaAte: ontem }, AGORA)).toBe(false);
  });
});
