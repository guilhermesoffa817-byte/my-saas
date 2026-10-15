import { describe, expect, it } from "vitest";
import { deDataLocal, deDataPura, paraDataPura } from "@/lib/formato";
import {
  aniversariantes,
  diaEMesDoNascimento,
  mensagemDeParabens,
  proximoAniversario,
  quandoFazAniversario,
} from "./aniversario";

/** O nascimento do jeito que a ficha do cliente guarda: meia-noite em São Paulo. */
const nasceu = (dia: string) => deDataLocal(dia)!;
const dia = (texto: string) => deDataPura(texto)!;

describe("dia e mês do nascimento", () => {
  it("lê no fuso do estúdio", () => {
    expect(diaEMesDoNascimento(nasceu("1990-10-14"))).toEqual({ mes: 10, dia: 14 });
    // 23h30 do dia 14 em São Paulo já é dia 15 em UTC. Vale o dia 14.
    expect(diaEMesDoNascimento(new Date("1990-10-15T02:30:00.000Z"))).toEqual({
      mes: 10,
      dia: 14,
    });
  });
});

describe("próximo aniversário", () => {
  it("é zero dia quando o aniversário é hoje", () => {
    expect(proximoAniversario(nasceu("1990-10-14"), dia("2026-10-14")).emDias).toBe(0);
  });

  it("conta os dias que faltam neste ano", () => {
    const proximo = proximoAniversario(nasceu("1985-10-20"), dia("2026-10-14"));
    expect(proximo.emDias).toBe(6);
    expect(paraDataPura(proximo.data)).toBe("2026-10-20");
  });

  it("quem fez ontem só volta no ano que vem", () => {
    const proximo = proximoAniversario(nasceu("1985-10-13"), dia("2026-10-14"));
    expect(paraDataPura(proximo.data)).toBe("2027-10-13");
    expect(proximo.emDias).toBe(364);
  });

  it("vira o ano: no fim de dezembro já enxerga o começo de janeiro", () => {
    const proximo = proximoAniversario(nasceu("2000-01-02"), dia("2026-12-28"));
    expect(paraDataPura(proximo.data)).toBe("2027-01-02");
    expect(proximo.emDias).toBe(5);
  });

  it("29 de fevereiro comemora no dia 28 quando o ano não é bissexto", () => {
    const em2027 = proximoAniversario(nasceu("2000-02-29"), dia("2027-02-25"));
    expect(paraDataPura(em2027.data)).toBe("2027-02-28");
    expect(em2027.emDias).toBe(3);
  });

  it("29 de fevereiro cai no próprio dia quando o ano é bissexto", () => {
    const em2028 = proximoAniversario(nasceu("2000-02-29"), dia("2028-02-25"));
    expect(paraDataPura(em2028.data)).toBe("2028-02-29");
    expect(em2028.emDias).toBe(4);
  });

  it("29 de fevereiro depois do dia 28 num ano comum espera o ano bissexto", () => {
    const proximo = proximoAniversario(nasceu("2000-02-29"), dia("2027-03-01"));
    expect(paraDataPura(proximo.data)).toBe("2028-02-29");
  });
});

describe("aniversariantes da semana", () => {
  const clientes = [
    { nome: "Bruna", nascimento: nasceu("1992-10-20") },
    { nome: "Ana", nascimento: nasceu("1988-10-14") },
    { nome: "Sem data", nascimento: null },
    { nome: "Carla", nascimento: nasceu("1995-10-21") },
    { nome: "Alice", nascimento: nasceu("1999-10-20") },
    { nome: "Dora", nascimento: nasceu("1970-10-13") },
  ];

  it("pega de hoje até seis dias depois, em ordem de data e de nome", () => {
    const lista = aniversariantes(clientes, dia("2026-10-14"));
    expect(lista.map((item) => [item.nome, item.emDias])).toEqual([
      ["Ana", 0],
      ["Alice", 6],
      ["Bruna", 6],
    ]);
  });

  it("vira o ano sem perder ninguém", () => {
    const lista = aniversariantes(
      [
        { nome: "Réveillon", nascimento: nasceu("1990-01-01") },
        { nome: "Natal", nascimento: nasceu("1990-12-25") },
        { nome: "Fim de ano", nascimento: nasceu("1990-12-31") },
      ],
      dia("2026-12-27"),
    );
    expect(lista.map((item) => item.nome)).toEqual(["Fim de ano", "Réveillon"]);
  });

  it("devolve vazio quando ninguém faz anos", () => {
    expect(aniversariantes(clientes, dia("2026-06-01"))).toEqual([]);
  });
});

describe("quando faz aniversário", () => {
  it("fala hoje e amanhã pelo nome", () => {
    expect(quandoFazAniversario(0, dia("2026-10-14"))).toBe("Hoje");
    expect(quandoFazAniversario(1, dia("2026-10-15"))).toBe("Amanhã");
  });

  it("dá o dia da semana e a data nos outros dias", () => {
    expect(quandoFazAniversario(3, dia("2026-10-17"))).toBe("Sábado, 17/10");
  });
});

describe("mensagem de parabéns", () => {
  it("no dia, deseja feliz aniversário pelo primeiro nome", () => {
    const texto = mensagemDeParabens({
      nomeDoCliente: "Úrsula Fernandes",
      nomeDoEstudio: "Espaço Íris",
      emDias: 0,
    });
    expect(texto.startsWith("Oi, Úrsula! Aqui é do Espaço Íris.")).toBe(true);
    expect(texto).toContain("feliz aniversário");
    expect(texto).not.toContain("Fernandes");
  });

  it("antes do dia, deixa os parabéns adiantados", () => {
    const texto = mensagemDeParabens({
      nomeDoCliente: "Bia",
      nomeDoEstudio: "Studio Bia",
      emDias: 3,
    });
    expect(texto).toContain("parabéns adiantados");
  });
});
