import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { deDataPura } from "@/lib/formato";
import {
  basesDoMes,
  carregarEquipe,
  desligarColaborador,
  excluirAusencia,
  excluirPagamento,
  lerColaborador,
  registrarAusencia,
  registrarPagamento,
  removerColaborador,
  salvarColaborador,
  type EntradaDoColaborador,
} from "@/lib/equipe-operacoes";

/** Monta a entrada do jeito que o formulário manda, campo a campo. */
function entrada(campos: Record<string, string>): EntradaDoColaborador {
  const lida = lerColaborador((campo) => campos[campo] ?? "");
  if ("erro" in lida) throw new Error(lida.erro);
  return lida;
}

async function cadastrar(usuarioId: string, campos: Record<string, string>) {
  const db = await banco();
  const salvo = await salvarColaborador(db, usuarioId, entrada({ inicio: "2026-01-05", ...campos }));
  if ("erro" in salvo) throw new Error(salvo.erro);
  return salvo.id;
}

async function pagar(usuarioId: string, colaboradorId: string, tipo: string, valorCentavos = 60000) {
  const db = await banco();
  return registrarPagamento(db, usuarioId, {
    colaboradorId,
    tipo: tipo as never,
    competencia: "2026-10",
    valorCentavos,
    pagoEm: "2026-11-05",
  });
}

describe.skipIf(!TEM_BANCO)("equipe no banco", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("equipe");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("o pagamento cria a saída nas Finanças, e apagar leva os dois", async () => {
    const db = await banco();
    const juliana = await cadastrar(estudio.usuario.id, {
      nome: "Juliana Prado",
      vinculo: "parceria",
      percentual: "60",
      documento: "529.982.247-25",
    });

    const pago = await pagar(estudio.usuario.id, juliana, "cota_parte", 84000);
    if ("erro" in pago) throw new Error(pago.erro);

    const lancamento = await db.lancamento.findUniqueOrThrow({ where: { id: pago.lancamentoId } });
    expect(lancamento).toMatchObject({
      usuarioId: estudio.usuario.id,
      tipo: "saida",
      descricao: "Cota-parte — Juliana P.",
      categoria: "Comissões e repasses",
      valorCentavos: 84000,
    });
    // A descrição nunca leva o CPF.
    expect(lancamento.descricao).not.toMatch(/\d{3}/);

    expect(await excluirPagamento(db, estudio.usuario.id, pago.id)).toBe(true);
    expect(await db.pagamentoDeColaborador.count({ where: { id: pago.id } })).toBe(0);
    expect(await db.lancamento.count({ where: { id: pago.lancamentoId } })).toBe(0);
  });

  it("o banco não deixa apagar a saída da Equipe por fora", async () => {
    const db = await banco();
    const rafael = await cadastrar(estudio.usuario.id, { nome: "Rafael Lima", vinculo: "clt", salario: "1.900,00" });
    const pago = await pagar(estudio.usuario.id, rafael, "salario", 190000);
    if ("erro" in pago) throw new Error(pago.erro);

    await expect(db.lancamento.delete({ where: { id: pago.lancamentoId } })).rejects.toThrow();
    expect(await db.lancamento.count({ where: { id: pago.lancamentoId } })).toBe(1);
  });

  it("cada vínculo só aceita as próprias palavras", async () => {
    const db = await banco();
    const mei = await cadastrar(estudio.usuario.id, { nome: "Bianca Rocha", vinculo: "mei", porAtendimento: "25" });
    const estagiaria = await cadastrar(estudio.usuario.id, { nome: "Lívia Souza", vinculo: "estagio", salario: "900" });

    const ferias = await registrarAusencia(db, estudio.usuario.id, {
      colaboradorId: mei,
      tipo: "ferias",
      inicio: "2026-10-10",
      fim: "2026-10-20",
    });
    expect("erro" in ferias).toBe(true);

    const indisponivel = await registrarAusencia(db, estudio.usuario.id, {
      colaboradorId: mei,
      tipo: "indisponivel",
      inicio: "2026-10-10",
      fim: "2026-10-12",
    });
    expect("erro" in indisponivel).toBe(false);

    expect("erro" in (await pagar(estudio.usuario.id, mei, "salario"))).toBe(true);
    expect("erro" in (await pagar(estudio.usuario.id, estagiaria, "salario"))).toBe(true);
    expect("erro" in (await pagar(estudio.usuario.id, estagiaria, "bolsa"))).toBe(false);

    // E se alguém passar por cima da tela, o banco recusa o tipo inventado.
    await expect(
      db.ausenciaDoColaborador.create({
        data: {
          usuarioId: estudio.usuario.id,
          colaboradorId: mei,
          tipo: "sumiu",
          inicio: deDataPura("2026-10-01")!,
          fim: deDataPura("2026-10-01")!,
        },
      }),
    ).rejects.toThrow();
  });

  it("não troca para PJ quem já tem histórico de emprego", async () => {
    const db = await banco();
    const campos = { nome: "Carla Mendes", vinculo: "clt", inicio: "2026-01-05" };
    const carla = await cadastrar(estudio.usuario.id, campos);

    // Sem histórico, o cadastro errado ainda pode ser corrigido.
    const corrigido = await salvarColaborador(db, estudio.usuario.id, entrada({ ...campos, id: carla, vinculo: "pj" }));
    expect("erro" in corrigido).toBe(false);
    await salvarColaborador(db, estudio.usuario.id, entrada({ ...campos, id: carla, vinculo: "clt" }));

    await registrarAusencia(db, estudio.usuario.id, {
      colaboradorId: carla,
      tipo: "ferias",
      inicio: "2026-07-01",
      fim: "2026-07-30",
    });
    const recusado = await salvarColaborador(db, estudio.usuario.id, entrada({ ...campos, id: carla, vinculo: "pj" }));
    expect(recusado).toMatchObject({ erro: expect.stringMatching(/registro de emprego/) });

    const continua = await db.colaborador.findUniqueOrThrow({ where: { id: carla } });
    expect(continua.vinculo).toBe("clt");
  });

  it("remover quem não recebeu nada apaga o cadastro e solta a agenda", async () => {
    const db = await banco();
    const bia = await cadastrar(estudio.usuario.id, { nome: "Bia Andrade", vinculo: "autonomo" });
    await registrarAusencia(db, estudio.usuario.id, {
      colaboradorId: bia,
      tipo: "indisponivel",
      inicio: "2026-10-01",
      fim: "2026-10-02",
    });
    await db.agendamento.update({ where: { id: estudio.agendamento.id }, data: { colaboradorId: bia } });

    const resultado = await removerColaborador(db, estudio.usuario.id, bia, "2026-10-15");
    expect(resultado).toEqual({ resultado: "removido" });
    expect(await db.colaborador.count({ where: { id: bia } })).toBe(0);
    expect(await db.ausenciaDoColaborador.count({ where: { colaboradorId: bia } })).toBe(0);

    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: estudio.agendamento.id } });
    expect(horario.colaboradorId).toBeNull();
  });

  it("remover quem já recebeu anonimiza e mantém os valores", async () => {
    const db = await banco();
    const juliana = await cadastrar(estudio.usuario.id, {
      nome: "Juliana Prado",
      cargo: "Cabeleireira",
      vinculo: "parceria",
      percentual: "60",
      documento: "529.982.247-25",
      pixChave: "juliana.prado@email.com.br",
      telefone: "(65) 99251-3501",
      email: "juliana.prado@email.com.br",
      observacoes: "Prefere receber às sextas-feiras.",
    });
    await registrarAusencia(db, estudio.usuario.id, {
      colaboradorId: juliana,
      tipo: "indisponivel",
      inicio: "2026-10-01",
      fim: "2026-10-02",
    });
    await db.agendamento.update({ where: { id: estudio.agendamento.id }, data: { colaboradorId: juliana } });
    const pago = await pagar(estudio.usuario.id, juliana, "cota_parte", 84000);
    if ("erro" in pago) throw new Error(pago.erro);

    const resultado = await removerColaborador(db, estudio.usuario.id, juliana, "2026-10-15");
    expect(resultado).toEqual({ resultado: "anonimizado" });

    const restou = await db.colaborador.findUniqueOrThrow({ where: { id: juliana } });
    expect(restou).toMatchObject({
      nome: "Ex-colaborador",
      cargo: null,
      documento: null,
      pixChave: null,
      telefone: null,
      email: null,
      observacoes: null,
    });
    expect(restou.anonimizadoEm).not.toBeNull();
    expect(restou.fim).not.toBeNull();
    expect(await db.ausenciaDoColaborador.count({ where: { colaboradorId: juliana } })).toBe(0);

    const lancamento = await db.lancamento.findUniqueOrThrow({ where: { id: pago.lancamentoId } });
    expect(lancamento.descricao).toBe("Cota-parte — Ex-colaborador");
    expect(lancamento.valorCentavos).toBe(84000);
    expect(await db.pagamentoDeColaborador.count({ where: { id: pago.id } })).toBe(1);

    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: estudio.agendamento.id } });
    expect(horario.colaboradorId).toBeNull();

    // Depois de removida, não se edita nem se paga mais.
    const edicao = await salvarColaborador(
      db,
      estudio.usuario.id,
      entrada({ id: juliana, nome: "Juliana Prado", vinculo: "parceria", inicio: "2026-01-05" }),
    );
    expect("erro" in edicao).toBe(true);
    expect("erro" in (await pagar(estudio.usuario.id, juliana, "cota_parte"))).toBe(true);
  });

  it("desligar grava o último dia e recusa data antes do início", async () => {
    const db = await banco();
    const rafael = await cadastrar(estudio.usuario.id, { nome: "Rafael Lima", vinculo: "clt", inicio: "2026-03-01" });
    expect("erro" in (await desligarColaborador(db, estudio.usuario.id, rafael, "2026-02-01"))).toBe(true);
    expect("erro" in (await desligarColaborador(db, estudio.usuario.id, rafael, "2026-10-31"))).toBe(false);
    const equipe = await carregarEquipe(db, estudio.usuario.id);
    expect(equipe.find((pessoa) => pessoa.id === rafael)?.fim).toBe("2026-10-31");
  });

  it("a base da comissão soma só os concluídos da pessoa, no mês do fuso do estúdio", async () => {
    const db = await banco();
    const juliana = await cadastrar(estudio.usuario.id, { nome: "Juliana Prado", vinculo: "parceria", percentual: "60" });
    const bianca = await cadastrar(estudio.usuario.id, { nome: "Bianca Rocha", vinculo: "mei", porAtendimento: "25" });

    const marcar = (inicio: string, status: string, colaboradorId: string | null) =>
      db.agendamento.create({
        data: {
          usuarioId: estudio.usuario.id,
          clienteId: estudio.cliente.id,
          servicoId: estudio.servico.id,
          inicio: new Date(inicio),
          status,
          colaboradorId,
        },
      });

    await marcar("2026-10-10T13:00:00.000Z", "concluido", juliana);
    // 31/10 às 23h30 em São Paulo já é 1º/11 em UTC, e ainda é outubro no estúdio.
    await marcar("2026-11-01T02:30:00.000Z", "concluido", juliana);
    await marcar("2026-10-11T13:00:00.000Z", "agendado", juliana);
    await marcar("2026-10-12T13:00:00.000Z", "cancelado", juliana);
    // 1º/11 às 00h30 em São Paulo: novembro.
    await marcar("2026-11-01T03:30:00.000Z", "concluido", juliana);
    await marcar("2026-10-13T13:00:00.000Z", "concluido", bianca);
    await marcar("2026-10-14T13:00:00.000Z", "concluido", null);

    const bases = await basesDoMes(db, estudio.usuario.id, "2026-10");
    expect(bases[juliana]).toEqual({ baseCentavos: 24000, atendimentos: 2 });
    expect(bases[bianca]).toEqual({ baseCentavos: 12000, atendimentos: 1 });
    expect(Object.keys(bases)).toHaveLength(2);
  });

  it("apagar a conta leva a equipe, os pagamentos e as saídas juntos", async () => {
    const db = await banco();
    const rafael = await cadastrar(estudio.usuario.id, { nome: "Rafael Lima", vinculo: "clt" });
    const pago = await pagar(estudio.usuario.id, rafael, "salario", 190000);
    if ("erro" in pago) throw new Error(pago.erro);

    await db.usuario.delete({ where: { id: estudio.usuario.id } });
    expect(await db.colaborador.count({ where: { usuarioId: estudio.usuario.id } })).toBe(0);
    expect(await db.pagamentoDeColaborador.count({ where: { usuarioId: estudio.usuario.id } })).toBe(0);
    expect(await db.lancamento.count({ where: { id: pago.lancamentoId } })).toBe(0);
  });
});

/**
 * Separação entre estúdios, na Equipe. Cada operação recebe o id de uma pessoa
 * do outro estúdio, como se alguém trocasse o id no navegador, e não pode nem
 * ler nem mudar nada.
 */
describe.skipIf(!TEM_BANCO)("um estúdio não mexe na equipe do outro", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;
  let daOutra: string;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("um");
    outro = await montarEstudio("outro");
    daOutra = await cadastrar(outro.usuario.id, {
      nome: "Juliana Prado",
      vinculo: "clt",
      salario: "1.900,00",
      documento: "529.982.247-25",
    });
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("a lista só traz a própria equipe", async () => {
    const db = await banco();
    expect(await carregarEquipe(db, um.usuario.id)).toEqual([]);
    expect(await carregarEquipe(db, outro.usuario.id)).toHaveLength(1);
  });

  it("não edita, não desliga e não remove a pessoa do outro", async () => {
    const db = await banco();
    const edicao = await salvarColaborador(
      db,
      um.usuario.id,
      entrada({ id: daOutra, nome: "Invasora", vinculo: "pj", inicio: "2026-01-05" }),
    );
    expect("erro" in edicao).toBe(true);
    expect("erro" in (await desligarColaborador(db, um.usuario.id, daOutra, "2026-10-01"))).toBe(true);
    expect("erro" in (await removerColaborador(db, um.usuario.id, daOutra, "2026-10-15"))).toBe(true);

    const intacta = await db.colaborador.findUniqueOrThrow({ where: { id: daOutra } });
    expect(intacta).toMatchObject({ nome: "Juliana Prado", vinculo: "clt", fim: null, anonimizadoEm: null });
  });

  it("não registra ausência nem pagamento para a pessoa do outro", async () => {
    const db = await banco();
    const ausencia = await registrarAusencia(db, um.usuario.id, {
      colaboradorId: daOutra,
      tipo: "ferias",
      inicio: "2026-10-01",
      fim: "2026-10-10",
    });
    expect("erro" in ausencia).toBe(true);
    expect("erro" in (await pagar(um.usuario.id, daOutra, "salario"))).toBe(true);
    expect(await db.lancamento.count({ where: { usuarioId: um.usuario.id } })).toBe(0);
  });

  it("não apaga a ausência nem o pagamento do outro", async () => {
    const db = await banco();
    const ausencia = await registrarAusencia(db, outro.usuario.id, {
      colaboradorId: daOutra,
      tipo: "folga",
      inicio: "2026-10-01",
      fim: "2026-10-01",
    });
    const pago = await pagar(outro.usuario.id, daOutra, "salario", 190000);
    if ("erro" in ausencia || "erro" in pago) throw new Error("preparo falhou");

    expect(await excluirAusencia(db, um.usuario.id, ausencia.id)).toBe(false);
    expect(await excluirPagamento(db, um.usuario.id, pago.id)).toBe(false);
    expect(await db.ausenciaDoColaborador.count({ where: { id: ausencia.id } })).toBe(1);
    expect(await db.pagamentoDeColaborador.count({ where: { id: pago.id } })).toBe(1);
    expect(await db.lancamento.count({ where: { id: pago.lancamentoId } })).toBe(1);
  });

  it("a base da comissão não soma atendimento do outro estúdio", async () => {
    const db = await banco();
    await db.agendamento.update({
      where: { id: outro.agendamento.id },
      data: { colaboradorId: daOutra, status: "concluido" },
    });
    expect(await basesDoMes(db, um.usuario.id, "2026-10")).toEqual({});
    expect((await basesDoMes(db, outro.usuario.id, "2026-10"))[daOutra]).toEqual({
      baseCentavos: 12000,
      atendimentos: 1,
    });
  });
});
