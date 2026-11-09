import { describe, expect, it } from "vitest";
import {
  PLANOS,
  RECADO_DA_DEMONSTRACAO,
  aplicarPagamento,
  avaliarAssinatura,
  diasDeCalendarioAte,
  economiaDoAnual,
  identificadorDoPix,
  mensalDoAnual,
  planoPorCodigo,
  planoValendo,
  receitaMensalCentavos,
  temPlanoAoMenos,
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
    expect(PLANOS.mensal.valorCentavos).toBe(7900);
    expect(PLANOS.anual.valorCentavos).toBe(79000);
    expect(PLANOS.pro_mensal.valorCentavos).toBe(12900);
    expect(PLANOS.pro_anual.valorCentavos).toBe(129000);
    expect(PLANOS.vip_mensal.valorCentavos).toBe(18900);
    expect(PLANOS.vip_anual.valorCentavos).toBe(189000);
  });

  it("chama os planos de Normal, Pro e VIP, com os códigos antigos valendo", () => {
    expect(PLANOS.mensal.nome).toBe("Normal mensal");
    expect(PLANOS.pro_anual.nome).toBe("Pro anual");
    expect(PLANOS.vip_anual.nome).toBe("VIP anual");
    // Quem tinha o Simples (mensal/anual) está no Normal; quem tinha o Completo (vip_*) está no VIP.
    expect(planoPorCodigo("anual").familia).toBe("normal");
    expect(planoPorCodigo("vip_mensal").familia).toBe("vip");
    expect(planoPorCodigo("pro_mensal").familia).toBe("pro");
    expect(planoPorCodigo("qualquer coisa").codigo).toBe("mensal");
    expect(planoPorCodigo("toString").codigo).toBe("mensal");
  });

  it("calcula a economia do anual em vez de prometer meses de brinde", () => {
    expect(economiaDoAnual("normal")).toBe(7900 * 12 - 79000);
    expect(economiaDoAnual("pro")).toBe(12900 * 12 - 129000);
    expect(economiaDoAnual("vip")).toBe(18900 * 12 - 189000);
    expect(mensalDoAnual("vip")).toBe(Math.floor(189000 / 12));
  });

  it("cada plano libera o seu nível e os de baixo, só pago e em dia", () => {
    const vip = { status: "ativa", plano: "vip_anual", validaAte: amanha };
    const pro = { status: "ativa", plano: "pro_mensal", validaAte: amanha };
    const normal = { status: "ativa", plano: "anual", validaAte: amanha };
    expect(temPlanoAoMenos(vip, "pro", AGORA)).toBe(true);
    expect(temPlanoAoMenos(vip, "vip", AGORA)).toBe(true);
    expect(temPlanoAoMenos(pro, "pro", AGORA)).toBe(true);
    expect(temPlanoAoMenos(pro, "vip", AGORA)).toBe(false);
    expect(temPlanoAoMenos(normal, "normal", AGORA)).toBe(true);
    expect(temPlanoAoMenos(normal, "pro", AGORA)).toBe(false);
    expect(temPlanoAoMenos({ ...vip, status: "teste" }, "pro", AGORA)).toBe(false);
    expect(temPlanoAoMenos({ ...vip, validaAte: ontem }, "pro", AGORA)).toBe(false);
  });
});

/* ------------------------------------------------- troca de plano */

const DIA = 86_400_000;
const daqui = (dias: number) => new Date(AGORA.getTime() + dias * DIA);
const ativa = (plano: string, dias: number) => ({ status: "ativa", plano, validaAte: daqui(dias) });

describe("o que um Pix confirmado faz com a assinatura", () => {
  it("mesma família: soma os dias do plano pago ao que já vale, e o plano passa a ser o pago", () => {
    const resultado = aplicarPagamento(ativa("mensal", 10), "anual", AGORA);
    expect(resultado.plano).toBe("anual");
    expect(resultado.validaAte).toEqual(daqui(10 + 365));
    expect(resultado.conversao).toBeNull();

    const completo = aplicarPagamento(ativa("vip_anual", 200), "vip_mensal", AGORA);
    expect(completo.plano).toBe("vip_mensal");
    expect(completo.validaAte).toEqual(daqui(230));
    expect(completo.conversao).toBeNull();
  });

  it("renovar o mesmo plano antes de vencer não perde nenhum dia", () => {
    const resultado = aplicarPagamento(ativa("vip_mensal", 3), "vip_mensal", AGORA);
    expect(resultado.validaAte).toEqual(daqui(33));
  });

  it("subir do Normal para o VIP: o saldo do Normal vira dias de VIP pelo preço do dia", () => {
    // 30 dias de Normal mensal = R$ 79,00 de crédito. O VIP mensal custa
    // R$ 189,00 / 30 = R$ 6,30 por dia: o crédito compra 12 dias (12,5 para baixo).
    const resultado = aplicarPagamento(ativa("mensal", 30), "vip_mensal", AGORA);
    expect(resultado.plano).toBe("vip_mensal");
    expect(resultado.conversao).toEqual({ de: "mensal", creditoCentavos: 7900, diasExtras: 12 });
    expect(resultado.validaAte).toEqual(daqui(30 + 12));
  });

  it("subir não dá mais VIP do que foi pago", () => {
    const resultado = aplicarPagamento(ativa("mensal", 30), "vip_mensal", AGORA);
    const dias = (resultado.validaAte.getTime() - AGORA.getTime()) / DIA;
    expect(dias).toBeLessThan(60);
    // O valor do que ela recebe não passa do que ela pagou: 42 dias × R$ 189/30 ≤ R$ 268.
    expect(Math.floor((dias * PLANOS.vip_mensal.valorCentavos) / 30)).toBeLessThanOrEqual(7900 + 18900);
  });

  it("descer do VIP anual para o Normal mensal: o saldo do VIP vira dias de Normal", () => {
    // 365 dias de VIP anual = R$ 1.890,00 de crédito; o Normal mensal custa
    // R$ 2,633... por dia: 717 dias a mais (717,7 para baixo), além dos 30 pagos.
    const resultado = aplicarPagamento(ativa("vip_anual", 365), "mensal", AGORA);
    expect(resultado.plano).toBe("mensal");
    expect(resultado.conversao).toEqual({ de: "vip_anual", creditoCentavos: 189000, diasExtras: 717 });
    expect(resultado.validaAte).toEqual(daqui(30 + 717));
  });

  it("conta o tempo que falta com as horas, sem dar o dia quebrado de presente", () => {
    // Faltam 10 dias e 12 horas de Normal mensal: R$ 79/30 × 10,5 = R$ 27,65.
    const atual = { status: "ativa", plano: "mensal", validaAte: new Date(AGORA.getTime() + 10.5 * DIA) };
    const resultado = aplicarPagamento(atual, "vip_mensal", AGORA);
    expect(resultado.conversao?.creditoCentavos).toBe(2765);
    // 2765 ÷ (18900 ÷ 30) = 4,39 dias: 4.
    expect(resultado.conversao?.diasExtras).toBe(4);
    expect(resultado.validaAte).toEqual(daqui(34));
  });

  it("sem plano nenhum (demonstração, conta nova): vale a partir de agora", () => {
    expect(aplicarPagamento(null, "vip_anual", AGORA)).toEqual({
      plano: "vip_anual",
      validaAte: daqui(365),
      conversao: null,
    });
    const demonstracao = { status: "demonstracao", plano: "mensal", validaAte: AGORA };
    expect(aplicarPagamento(demonstracao, "mensal", AGORA).validaAte).toEqual(daqui(30));
  });

  it("plano vencido não vira crédito: o plano novo começa agora", () => {
    const resultado = aplicarPagamento(ativa("mensal", -5), "vip_mensal", AGORA);
    expect(resultado.plano).toBe("vip_mensal");
    expect(resultado.conversao).toBeNull();
    expect(resultado.validaAte).toEqual(daqui(30));
  });

  it("o teste grátis antigo não é plano pago: os dias dele continuam e o plano pago soma", () => {
    const teste = { status: "teste", plano: "vip_mensal", validaAte: daqui(2) };
    const resultado = aplicarPagamento(teste, "mensal", AGORA);
    expect(resultado.conversao).toBeNull();
    expect(resultado.validaAte).toEqual(daqui(32));
  });

  it("código desconhecido vira o Normal mensal, como em todo o resto", () => {
    expect(aplicarPagamento(null, "plano-que-nao-existe", AGORA).plano).toBe("mensal");
  });
});

describe("o plano que está valendo", () => {
  it("só conta assinatura paga e dentro da validade", () => {
    expect(planoValendo(ativa("vip_anual", 1), AGORA)?.codigo).toBe("vip_anual");
    expect(planoValendo(ativa("vip_anual", -1), AGORA)).toBeNull();
    expect(planoValendo({ status: "teste", plano: "mensal", validaAte: amanha }, AGORA)).toBeNull();
    expect(planoValendo(null, AGORA)).toBeNull();
  });
});

describe("receita por mês do admin", () => {
  it("soma cada assinatura em dia pelo próprio plano, com o anual dividido por doze", () => {
    const assinaturas = [
      ...Array.from({ length: 7 }, () => ativa("mensal", 10)),
      ...Array.from({ length: 9 }, () => ativa("vip_mensal", 10)),
      ativa("anual", 100),
      // Vencida, teste e demonstração não entram.
      ativa("vip_anual", -1),
      { status: "teste", plano: "mensal", validaAte: amanha },
      { status: "demonstracao", plano: "mensal", validaAte: AGORA },
      null,
    ];
    // 7 × 79 + 9 × 189 + 790 / 12 = R$ 2.319,83
    expect(receitaMensalCentavos(assinaturas, AGORA)).toBe(231983);
  });
});

describe("identificador do Pix de cada conta", () => {
  it("é diferente para cada conta, só com letras e números, e cabe no Pix", () => {
    const um = identificadorDoPix("cmgx1a2b3c4d5e6f7g8h9i0j");
    const outro = identificadorDoPix("cmgx1a2b3c4d5e6f7g8h9i0k");
    expect(um).not.toBe(outro);
    expect(um).toMatch(/^BOSSA[A-Z0-9]{1,12}$/);
    expect(um.length).toBeLessThanOrEqual(25);
  });
});

describe("validade, em vez de \"renova em\"", () => {
  // 18/10/2026 às 00:20 em São Paulo.
  const MEIA_NOITE = new Date("2026-10-18T03:20:00.000Z");

  it("conta dias de calendário em São Paulo, não blocos de 24 horas", () => {
    // Vence amanhã às 9h: é "amanhã", não "faltam 2 dias".
    expect(diasDeCalendarioAte(new Date("2026-10-19T12:00:00.000Z"), MEIA_NOITE)).toBe(1);
    // Vence depois de amanhã às 23h30.
    expect(diasDeCalendarioAte(new Date("2026-10-21T02:30:00.000Z"), MEIA_NOITE)).toBe(2);
    // Hoje mais tarde.
    expect(diasDeCalendarioAte(new Date("2026-10-18T20:00:00.000Z"), MEIA_NOITE)).toBe(0);
  });

  it("fala da data da validade e avisa quando faltam cinco dias ou menos", () => {
    const longe = avaliarAssinatura({ status: "ativa", validaAte: new Date("2026-11-17T15:00:00.000Z") }, MEIA_NOITE);
    expect(longe.recado).toBe("Sua assinatura está em dia e vale até 17/11/2026.");
    expect(longe.venceLogo).toBe(false);

    const perto = avaliarAssinatura({ status: "ativa", validaAte: new Date("2026-10-21T02:30:00.000Z") }, MEIA_NOITE);
    expect(perto.venceLogo).toBe(true);
    expect(perto.diasRestantes).toBe(2);
    expect(perto.recado).toContain("vale até 20/10/2026 (faltam 2 dias)");
    expect(perto.recado).not.toMatch(/renova/);

    const amanhaCedo = avaliarAssinatura({ status: "ativa", validaAte: new Date("2026-10-19T12:00:00.000Z") }, MEIA_NOITE);
    expect(amanhaCedo.recado).toContain("vale até amanhã, 19/10/2026");

    const cinco = avaliarAssinatura({ status: "ativa", validaAte: new Date("2026-10-23T15:00:00.000Z") }, MEIA_NOITE);
    expect(cinco.venceLogo).toBe(true);
    const seis = avaliarAssinatura({ status: "ativa", validaAte: new Date("2026-10-24T15:00:00.000Z") }, MEIA_NOITE);
    expect(seis.venceLogo).toBe(false);
  });

  it("o teste antigo e a assinatura vencida não pedem aviso de fim", () => {
    expect(avaliarAssinatura({ status: "teste", validaAte: amanha }, AGORA).venceLogo).toBe(false);
    expect(avaliarAssinatura({ status: "ativa", validaAte: ontem }, AGORA).venceLogo).toBe(false);
  });
});
