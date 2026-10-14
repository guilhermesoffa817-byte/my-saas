import { describe, expect, it } from "vitest";
import { linkDoWhatsApp } from "@/lib/telefone";
import { mensagemDeConfirmacao, ordenarParaConfirmar, quandoPorExtenso } from "./confirmacao";

// Quarta-feira, 14 de outubro de 2026, 10h em São Paulo.
const agora = new Date("2026-10-14T13:00:00.000Z");
// Quinta-feira, 15 de outubro, 9h em São Paulo (12h em UTC).
const amanhaAsNove = new Date("2026-10-15T12:00:00.000Z");

describe("quando é o horário", () => {
  it("diz amanhã, com o dia da semana e a data", () => {
    expect(quandoPorExtenso(amanhaAsNove, agora)).toBe("amanhã, quinta-feira (15/10)");
  });

  it("diz hoje quando o horário é no mesmo dia", () => {
    expect(quandoPorExtenso(new Date("2026-10-14T20:00:00.000Z"), agora)).toBe(
      "hoje, quarta-feira (14/10)",
    );
  });

  it("dá só o dia quando falta mais tempo", () => {
    expect(quandoPorExtenso(new Date("2026-10-17T12:00:00.000Z"), agora)).toBe(
      "sábado (17/10)",
    );
  });

  it("conta o dia pelo fuso do estúdio, não pelo do servidor", () => {
    // 23h30 de quinta em São Paulo já é sexta em UTC. Para o cliente, é quinta.
    const quintaANoite = new Date("2026-10-16T02:30:00.000Z");
    expect(quandoPorExtenso(quintaANoite, agora)).toBe("amanhã, quinta-feira (15/10)");
  });
});

describe("mensagem de confirmação", () => {
  const mensagem = mensagemDeConfirmacao({
    nomeDoCliente: "  Ângela Maria da Conceição ",
    nomeDoEstudio: "Espaço Íris",
    nomeDoServico: "Depilação com cera",
    inicio: amanhaAsNove,
    agora,
  });

  it("chama o cliente pelo primeiro nome, com acento", () => {
    expect(mensagem.startsWith("Oi, Ângela! ")).toBe(true);
    expect(mensagem).not.toContain("Maria");
  });

  it("traz o estúdio, o serviço, o dia e a hora no fuso do estúdio", () => {
    expect(mensagem).toBe(
      "Oi, Ângela! Aqui é do Espaço Íris. Passando para confirmar o seu horário de Depilação com cera: amanhã, quinta-feira (15/10), às 09:00. Você confirma? É só responder por aqui.",
    );
  });

  it("escreve a hora com dois dígitos e os minutos", () => {
    const tarde = mensagemDeConfirmacao({
      nomeDoCliente: "Bia",
      nomeDoEstudio: "Studio Bia",
      nomeDoServico: "Manicure",
      inicio: new Date("2026-10-15T17:30:00.000Z"),
      agora,
    });
    expect(tarde).toContain("às 14:30.");
  });

  it("pede a confirmação", () => {
    expect(mensagem).toContain("Você confirma?");
  });

  it("chega inteira no link do WhatsApp, acentos e tudo", () => {
    const link = linkDoWhatsApp("5566992513501", mensagem);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(mensagem);
    expect(link).toContain("%C3%82ngela");
  });
});

describe("ordem da lista da véspera", () => {
  it("põe quem falta confirmar primeiro e quem já recebeu no fim, cada grupo pela hora", () => {
    const lista = [
      { nome: "Carla", inicio: new Date("2026-10-15T18:00:00.000Z"), confirmacaoEnviadaEm: null },
      {
        nome: "Ana",
        inicio: new Date("2026-10-15T12:00:00.000Z"),
        confirmacaoEnviadaEm: new Date("2026-10-14T13:00:00.000Z"),
      },
      { nome: "Bia", inicio: new Date("2026-10-15T14:00:00.000Z"), confirmacaoEnviadaEm: null },
      {
        nome: "Duda",
        inicio: new Date("2026-10-15T11:00:00.000Z"),
        confirmacaoEnviadaEm: new Date("2026-10-14T13:05:00.000Z"),
      },
    ];

    expect(ordenarParaConfirmar(lista).map((item) => item.nome)).toEqual([
      "Bia",
      "Carla",
      "Duda",
      "Ana",
    ]);
  });

  it("não mexe na lista original", () => {
    const lista = [
      { inicio: new Date("2026-10-15T18:00:00.000Z"), confirmacaoEnviadaEm: null },
      { inicio: new Date("2026-10-15T12:00:00.000Z"), confirmacaoEnviadaEm: null },
    ];
    ordenarParaConfirmar(lista);
    expect(lista[0].inicio.toISOString()).toBe("2026-10-15T18:00:00.000Z");
  });
});
