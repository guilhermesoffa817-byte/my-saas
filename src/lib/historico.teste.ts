import { describe, expect, it } from "vitest";
import {
  perguntaParaTirarDaLista,
  resumoDoHistorico,
  separarAtendimentos,
  temHistorico,
} from "./historico";

const AGORA = new Date("2026-10-14T15:00:00.000Z");

function atendimento(
  inicio: string,
  status: string,
  valorCentavos: number | null = 10000,
  precoCentavos = 15000,
) {
  return {
    id: `${inicio}-${status}`,
    inicio: new Date(inicio),
    status,
    valorCentavos,
    servico: { precoCentavos },
  };
}

describe("resumo do histórico", () => {
  it("conta como visita só o atendimento concluído", () => {
    const resumo = resumoDoHistorico(
      [
        atendimento("2026-09-01T12:00:00.000Z", "concluido"),
        atendimento("2026-09-08T12:00:00.000Z", "cancelado"),
        atendimento("2026-09-15T12:00:00.000Z", "faltou"),
        atendimento("2026-09-22T12:00:00.000Z", "concluido"),
        atendimento("2026-10-20T12:00:00.000Z", "agendado"),
      ],
      AGORA,
    );

    expect(resumo.visitas).toBe(2);
    expect(resumo.faltas).toBe(1);
  });

  it("soma o valor combinado, não o preço de hoje do serviço", () => {
    const resumo = resumoDoHistorico(
      [
        atendimento("2026-09-01T12:00:00.000Z", "concluido", 10000, 15000),
        // Horário antigo, de antes do valor ser guardado: cai no preço do serviço.
        atendimento("2026-09-02T12:00:00.000Z", "concluido", null, 15000),
        // Combinado de graça continua valendo zero.
        atendimento("2026-09-03T12:00:00.000Z", "concluido", 0, 15000),
        // Falta e cancelamento não entram no que ela gastou.
        atendimento("2026-09-04T12:00:00.000Z", "faltou", 9000),
        atendimento("2026-09-05T12:00:00.000Z", "cancelado", 9000),
      ],
      AGORA,
    );

    expect(resumo.totalGastoCentavos).toBe(25000);
  });

  it("acha a última visita e o próximo horário", () => {
    const ultima = atendimento("2026-10-10T12:00:00.000Z", "concluido");
    const proximo = atendimento("2026-10-16T12:00:00.000Z", "agendado");

    const resumo = resumoDoHistorico(
      [
        atendimento("2026-09-01T12:00:00.000Z", "concluido"),
        ultima,
        atendimento("2026-10-30T12:00:00.000Z", "agendado"),
        proximo,
        // Cancelado no futuro não é próximo horário.
        atendimento("2026-10-15T12:00:00.000Z", "cancelado"),
        // Agendado que já passou e ninguém fechou também não é.
        atendimento("2026-10-13T12:00:00.000Z", "agendado"),
      ],
      AGORA,
    );

    expect(resumo.ultimaVisita).toBe(ultima);
    expect(resumo.proximo).toBe(proximo);
  });

  it("cliente nova não tem visita nem próximo horário", () => {
    expect(resumoDoHistorico([], AGORA)).toEqual({
      visitas: 0,
      totalGastoCentavos: 0,
      faltas: 0,
      ultimaVisita: null,
      proximo: null,
    });
  });
});

describe("separar atendimentos", () => {
  it("próximos em ordem de data, anteriores do mais recente para o mais antigo", () => {
    const { proximos, anteriores } = separarAtendimentos(
      [
        atendimento("2026-10-30T12:00:00.000Z", "agendado"),
        atendimento("2026-09-01T12:00:00.000Z", "concluido"),
        atendimento("2026-10-16T12:00:00.000Z", "agendado"),
        atendimento("2026-10-01T12:00:00.000Z", "faltou"),
        atendimento("2026-10-20T12:00:00.000Z", "cancelado"),
      ],
      AGORA,
    );

    expect(proximos.map((item) => item.inicio.toISOString())).toEqual([
      "2026-10-16T12:00:00.000Z",
      "2026-10-30T12:00:00.000Z",
    ]);
    expect(anteriores.map((item) => item.status)).toEqual(["faltou", "concluido"]);
  });

  it("corta os anteriores no limite e diz quantos ficaram de fora", () => {
    const muitos = Array.from({ length: 25 }, (_, posicao) =>
      atendimento(new Date(Date.UTC(2026, 0, 1 + posicao, 12)).toISOString(), "concluido"),
    );

    const { anteriores, anterioresForaDaLista } = separarAtendimentos(muitos, AGORA, 20);
    expect(anteriores).toHaveLength(20);
    expect(anterioresForaDaLista).toBe(5);
    // O mais recente vem primeiro.
    expect(anteriores[0].inicio.toISOString()).toBe("2026-01-25T12:00:00.000Z");
  });

  it("não mexe na ordem da lista que recebeu", () => {
    const lista = [
      atendimento("2026-09-01T12:00:00.000Z", "concluido"),
      atendimento("2026-09-02T12:00:00.000Z", "concluido"),
    ];
    separarAtendimentos(lista, AGORA);
    expect(lista[0].inicio.toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("tem histórico", () => {
  it("qualquer atendimento ou cobrança conta como histórico", () => {
    expect(temHistorico({ atendimentos: 0, cobrancas: 0 })).toBe(false);
    expect(temHistorico({ atendimentos: 1, cobrancas: 0 })).toBe(true);
    expect(temHistorico({ atendimentos: 0, cobrancas: 1 })).toBe(true);
  });
});

describe("pergunta antes de tirar da lista", () => {
  it("sem histórico, avisa que a ficha some de vez", () => {
    const pergunta = perguntaParaTirarDaLista({
      nome: "Marina",
      comHistorico: false,
      horariosMarcados: 0,
    });
    expect(pergunta).toMatch(/^Apagar a ficha de Marina\?/);
    expect(pergunta).toContain("some de vez");
  });

  it("com histórico, fala em arquivar e em histórico guardado", () => {
    const pergunta = perguntaParaTirarDaLista({
      nome: "Marina",
      comHistorico: true,
      horariosMarcados: 0,
    });
    expect(pergunta).toMatch(/^Arquivar a ficha de Marina\?/);
    expect(pergunta).toContain("continuam guardados");
    expect(pergunta).not.toContain("cancelad");
  });

  it("diz quantos horários marcados serão cancelados, no singular e no plural", () => {
    expect(
      perguntaParaTirarDaLista({ nome: "Marina", comHistorico: true, horariosMarcados: 1 }),
    ).toContain("O horário marcado dela será cancelado.");
    expect(
      perguntaParaTirarDaLista({ nome: "Marina", comHistorico: true, horariosMarcados: 3 }),
    ).toContain("Os 3 horários marcados dela serão cancelados.");
  });
});
