import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";

/**
 * O que precisa dar o mesmo resultado quando acontece duas vezes.
 *
 * Toque duplo num botão de celular é regra, não exceção: o dedo encosta, a tela
 * demora, a pessoa toca de novo. Nenhuma dessas ações pode cobrar em dobro nem
 * lançar dinheiro em dobro.
 */
describe.skipIf(!TEM_BANCO)("nada em dobro", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("teste");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("o banco recusa uma segunda cobrança viva para o mesmo horário", async () => {
    const db = await banco();

    await expect(
      db.cobranca.create({
        data: {
          usuarioId: estudio.usuario.id,
          clienteId: estudio.cliente.id,
          agendamentoId: estudio.agendamento.id,
          valorCentavos: 12000,
          vencimento: new Date("2026-10-05T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();

    const quantas = await db.cobranca.count({
      where: { agendamentoId: estudio.agendamento.id },
    });
    expect(quantas).toBe(1);
  });

  it("depois de cancelar, dá para cobrar o mesmo horário de novo", async () => {
    const db = await banco();
    await db.cobranca.update({
      where: { id: estudio.cobranca.id },
      data: { situacao: "cancelada" },
    });

    const nova = await db.cobranca.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        agendamentoId: estudio.agendamento.id,
        valorCentavos: 12000,
        vencimento: new Date("2026-10-06T00:00:00.000Z"),
      },
    });
    expect(nova.situacao).toBe("aberta");
  });

  it("marcar como paga duas vezes só muda a cobrança uma vez", async () => {
    const db = await banco();

    // É a mesma condição usada pela ação: só muda quem ainda está aberta.
    const primeira = await db.cobranca.updateMany({
      where: { id: estudio.cobranca.id, usuarioId: estudio.usuario.id, situacao: "aberta" },
      data: { situacao: "paga", formaDePagamento: "pix" },
    });
    const segunda = await db.cobranca.updateMany({
      where: { id: estudio.cobranca.id, usuarioId: estudio.usuario.id, situacao: "aberta" },
      data: { situacao: "paga", formaDePagamento: "pix" },
    });

    expect(primeira.count).toBe(1);
    // A segunda não encontra nada para mudar, então o lançamento não é criado.
    expect(segunda.count).toBe(0);
  });

  it("registrar o mesmo lembrete duas vezes não cria duas linhas", async () => {
    const db = await banco();

    const dados = [
      { cobrancaId: estudio.cobranca.id, momento: "antes" },
      { cobrancaId: estudio.cobranca.id, momento: "no_dia" },
    ];

    await db.lembreteDeCobranca.createMany({ data: dados, skipDuplicates: true });
    await db.lembreteDeCobranca.createMany({ data: dados, skipDuplicates: true });

    const quantos = await db.lembreteDeCobranca.count({
      where: { cobrancaId: estudio.cobranca.id },
    });
    expect(quantos).toBe(2);
  });

  it("o vencimento volta do banco no mesmo dia em que entrou", async () => {
    const db = await banco();

    // A coluna é `date`. Se ela virasse timestamp, ou se a leitura passasse
    // pelo fuso, este dia 1º voltaria como dia 30 do mês anterior.
    const cobranca = await db.cobranca.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        valorCentavos: 5000,
        vencimento: new Date("2026-11-01T00:00:00.000Z"),
      },
    });

    const lida = await db.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(lida.vencimento.toISOString().slice(0, 10)).toBe("2026-11-01");
  });
});

/**
 * O defeito que apareceu quando a tela foi aberta num plano sem lembretes:
 * caixa de seleção desabilitada não é enviada pelo navegador, e a ação lia a
 * ausência como "desmarcada". Resultado: salvar a chave Pix apagava em silêncio
 * a preferência de lembrete de quem um dia assinou o VIP.
 */
describe.skipIf(!TEM_BANCO)("ajustes de cobrança", () => {
  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("salvar a chave Pix não pode apagar as preferências de lembrete", async () => {
    await limpar();
    const db = await banco();
    const estudio = await montarEstudio("ajustes");

    // Alguém que já configurou os lembretes do jeito que quer.
    await db.usuario.update({
      where: { id: estudio.usuario.id },
      data: { lembreteAntes: true, lembreteNoDia: true, lembreteTresDias: false, lembreteSeteDias: true },
    });

    // Um formulário sem nenhuma caixa enviada, que é o que o navegador manda
    // quando elas estão desabilitadas.
    const semLembretes = {};

    await db.usuario.update({
      where: { id: estudio.usuario.id },
      data: { pixChave: "+5566992513501", pixCidade: "Cuiabá", ...semLembretes },
    });

    const depois = await db.usuario.findUniqueOrThrow({ where: { id: estudio.usuario.id } });
    expect(depois.pixChave).toBe("+5566992513501");
    expect(depois.lembreteAntes).toBe(true);
    expect(depois.lembreteNoDia).toBe(true);
    expect(depois.lembreteTresDias).toBe(false);
    expect(depois.lembreteSeteDias).toBe(true);
  });
});
