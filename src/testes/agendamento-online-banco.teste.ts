import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { hora } from "@/lib/formato";
import { embaralhar } from "@/lib/agendamento-online/embaralhar";
import {
  LIMITE_POR_IP,
  LIMITE_POR_TELEFONE,
  agendarPeloLink,
  carregarAgendaPublica,
  horariosOferecidos,
  ligarAgendaOnline,
  marcarNovosComoVistos,
  novosPeloLink,
  salvarConfiguracao,
  type AgendaPublica,
  type PedidoDeAgendamento,
} from "@/lib/agendamento-online/operacoes";
import { HORARIO_JA_OCUPADO, mudarStatusDoHorario } from "@/lib/agenda-operacoes";

/**
 * Agendamento online no banco de verdade: a página é pública, então o que se
 * confere aqui é que ela só abre o que deve, não deixa dois clientes com o
 * mesmo horário, segura quem insiste e nunca mistura um estúdio com outro.
 */

/** Segunda, 19/10/2026, 08:00 em São Paulo. */
const AGORA = new Date("2026-10-19T11:00:00.000Z");
const sp = (texto: string) => new Date(`${texto}:00-03:00`);
const embaralharTelefone = (telefone: string) => embaralhar("telefone", telefone);

type Estudio = Awaited<ReturnType<typeof montarEstudio>>;

async function abrirAgenda(estudio: Estudio, link: string, extra: { plano?: string } = {}) {
  const db = await banco();
  await db.assinatura.create({
    data: {
      usuarioId: estudio.usuario.id,
      status: "ativa",
      plano: extra.plano ?? "mensal",
      validaAte: new Date("2026-12-31T00:00:00.000Z"),
    },
  });
  // Segunda a sábado, das 9h às 12h e das 13h às 18h.
  const faixas = [1, 2, 3, 4, 5, 6].flatMap((diaDaSemana) => [
    { diaDaSemana, inicioMin: 540, fimMin: 720 },
    { diaDaSemana, inicioMin: 780, fimMin: 1080 },
  ]);
  const salvo = await salvarConfiguracao(db, estudio.usuario.id, {
    link,
    antecedenciaMin: 120,
    diasAFrente: 30,
    faixas,
    servicosIds: [estudio.servico.id],
    escolherQuemAtende: false,
    donaAtende: true,
  });
  expect(salvo).toEqual({ ok: true });
  expect(await ligarAgendaOnline(db, estudio.usuario.id, true)).toEqual({ ok: true });
}

function pedido(estudio: Estudio, link: string, extra: Partial<PedidoDeAgendamento> = {}): PedidoDeAgendamento {
  return {
    link,
    servicoId: estudio.servico.id,
    quem: "",
    dia: "2026-10-20",
    hora: "10:00",
    nome: "Juliana Prado",
    telefone: "(11) 98765-4321",
    isca: "",
    ...extra,
  };
}

async function abertaOuFalha(link: string, agora = AGORA): Promise<AgendaPublica> {
  const pagina = await carregarAgendaPublica(await banco(), link, agora);
  if (pagina.situacao !== "aberta") throw new Error(`Página ${link} não abriu: ${pagina.situacao}`);
  return pagina.agenda;
}

describe.skipIf(!TEM_BANCO)("agendamento online no banco", () => {
  let um: Estudio;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("um");
    await abrirAgenda(um, "estudio-um");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("link que não existe, link desligado e conta parada não abrem a página", async () => {
    const db = await banco();
    expect(await carregarAgendaPublica(db, "nao-existe", AGORA)).toEqual({ situacao: "nao_encontrada" });
    expect(await carregarAgendaPublica(db, "../admin", AGORA)).toEqual({ situacao: "nao_encontrada" });
    expect(await carregarAgendaPublica(db, "%E0", AGORA)).toEqual({ situacao: "nao_encontrada" });

    await ligarAgendaOnline(db, um.usuario.id, false);
    expect(await carregarAgendaPublica(db, "estudio-um", AGORA)).toEqual({ situacao: "nao_encontrada" });
    expect(await agendarPeloLink(db, pedido(um, "estudio-um"), { ipHash: "ip", embaralharTelefone, agora: AGORA })).toEqual({
      erro: "Esta página de agendamento não está disponível.",
    });

    await ligarAgendaOnline(db, um.usuario.id, true);
    await db.assinatura.update({
      where: { usuarioId: um.usuario.id },
      data: { validaAte: new Date("2026-10-01T00:00:00.000Z") },
    });
    expect(await carregarAgendaPublica(db, "estudio-um", AGORA)).toEqual({ situacao: "indisponivel" });
    expect(await agendarPeloLink(db, pedido(um, "estudio-um"), { ipHash: "ip", embaralharTelefone, agora: AGORA })).toEqual({
      erro: "O agendamento online está indisponível no momento.",
    });
    expect(await db.agendamento.count({ where: { usuarioId: um.usuario.id, origem: "link" } })).toBe(0);
  });

  it("horário cancelado e ocupado pelo link não volta para agendado por cima do novo", async () => {
    const db = await banco();
    // A dona tinha um atendimento às 10h de terça e cancelou.
    const antigo = await db.agendamento.create({
      data: {
        usuarioId: um.usuario.id,
        clienteId: um.cliente.id,
        servicoId: um.servico.id,
        inicio: sp("2026-10-20T10:00"),
        status: "cancelado",
      },
    });
    // O horário voltou para a página, e um cliente marcou.
    const marcado = await agendarPeloLink(db, pedido(um, "estudio-um"), {
      ipHash: "ip-reativar",
      embaralharTelefone,
      agora: AGORA,
    });
    expect(marcado).toHaveProperty("ok", true);

    // Desfazer o cancelamento agora poria dois clientes no mesmo horário.
    expect(
      await mudarStatusDoHorario(db, um.usuario.id, { id: antigo.id, status: "agendado", cancelarCobranca: false }),
    ).toMatchObject({ erro: HORARIO_JA_OCUPADO, motivo: "ocupado" });
    expect((await db.agendamento.findUniqueOrThrow({ where: { id: antigo.id } })).status).toBe("cancelado");

    // Sem ninguém no lugar, a volta é livre, como sempre foi.
    await db.agendamento.updateMany({ where: { usuarioId: um.usuario.id, origem: "link" }, data: { status: "cancelado" } });
    expect(
      await mudarStatusDoHorario(db, um.usuario.id, { id: antigo.id, status: "agendado", cancelarCobranca: false }),
    ).toMatchObject({ resultado: "feito" });
  });

  it("só mostra os serviços que a dona deixou aparecer", async () => {
    const db = await banco();
    await db.servico.create({
      data: { usuarioId: um.usuario.id, nome: "Escondido", precoCentavos: 5000, agendavelOnline: false },
    });
    await db.servico.create({
      data: { usuarioId: um.usuario.id, nome: "Guardado", precoCentavos: 5000, ativo: false },
    });
    const agenda = await abertaOuFalha("estudio-um");
    expect(agenda.servicos.map((s) => s.nome)).toEqual(["Atendimento"]);
  });

  it("os horários ocupados e os que já passaram não aparecem", async () => {
    const db = await banco();
    await db.agendamento.create({
      data: {
        usuarioId: um.usuario.id,
        clienteId: um.cliente.id,
        servicoId: um.servico.id,
        inicio: sp("2026-10-19T14:00"),
      },
    });
    // Cancelado solta o horário.
    await db.agendamento.create({
      data: {
        usuarioId: um.usuario.id,
        clienteId: um.cliente.id,
        servicoId: um.servico.id,
        inicio: sp("2026-10-19T16:00"),
        status: "cancelado",
      },
    });
    const agenda = await abertaOuFalha("estudio-um");
    const [hoje] = await horariosOferecidos(db, agenda, agenda.servicos[0], { id: null }, AGORA, "2026-10-19");
    const lista = hoje.horarios.map((h) => hora(h.inicio));
    // Agora são 08:00 com 2 h de antecedência: começa às 10:00.
    expect(lista[0]).toBe("10:00");
    expect(lista).not.toContain("09:00");
    // O atendimento das 14h (60 min) derruba 13:30, 14:00 e 14:30.
    expect(lista).not.toContain("13:30");
    expect(lista).not.toContain("14:00");
    expect(lista).not.toContain("14:30");
    expect(lista).toContain("15:00");
    expect(lista).toContain("16:00");
  });

  it("marca, cria o cliente pelo telefone e deixa a observação", async () => {
    const db = await banco();
    const resposta = await agendarPeloLink(db, pedido(um, "estudio-um"), {
      ipHash: "ip-1",
      embaralharTelefone,
      agora: AGORA,
    });
    expect(resposta).toMatchObject({
      ok: true,
      resumo: { servico: "Atendimento", nomeNegocio: "Estúdio um", primeiroNome: "Juliana", quem: null },
    });
    if (!("ok" in resposta)) throw new Error("não marcou");
    expect(resposta.resumo.quando).toContain("10:00");

    const marcado = await db.agendamento.findFirstOrThrow({
      where: { usuarioId: um.usuario.id, origem: "link" },
      include: { cliente: true },
    });
    expect(marcado.inicio.toISOString()).toBe(sp("2026-10-20T10:00").toISOString());
    expect(marcado.observacoes).toBe("Marcado pelo link");
    expect(marcado.cliente.telefone).toBe("11987654321");
    expect(marcado.cliente.nome).toBe("Juliana Prado");

    // A tentativa ficou registrada sem telefone nem IP em texto.
    const tentativa = await db.tentativaDeAgendamento.findFirstOrThrow({ where: { usuarioId: um.usuario.id } });
    expect(tentativa.sucesso).toBe(true);
    expect(tentativa.telefoneHash).not.toContain("98765");
  });

  it("reaproveita o cliente com o mesmo WhatsApp, escrito de qualquer jeito, sem mudar a ficha", async () => {
    const db = await banco();
    const existente = await db.cliente.create({
      data: { usuarioId: um.usuario.id, nome: "Marina Alves", telefone: "+55 (11) 98765-4321" },
    });
    const resposta = await agendarPeloLink(db, pedido(um, "estudio-um", { nome: "Marina A." }), {
      ipHash: "ip-1",
      embaralharTelefone,
      agora: AGORA,
    });
    expect(resposta).toHaveProperty("ok", true);
    const marcado = await db.agendamento.findFirstOrThrow({ where: { usuarioId: um.usuario.id, origem: "link" } });
    expect(marcado.clienteId).toBe(existente.id);
    expect(marcado.observacoes).toBe("Marcado pelo link · nome informado: Marina A.");
    expect((await db.cliente.findUniqueOrThrow({ where: { id: existente.id } })).nome).toBe("Marina Alves");
    // E a resposta pública não devolve o nome guardado na ficha.
    expect(JSON.stringify(resposta)).not.toContain("Marina Alves");
  });

  it("dois clientes no mesmo horário ao mesmo tempo: só um leva", async () => {
    const db = await banco();
    const respostas = await Promise.all([
      agendarPeloLink(db, pedido(um, "estudio-um", { telefone: "11911112222", nome: "Ana Lima" }), {
        ipHash: "ip-a",
        embaralharTelefone,
        agora: AGORA,
      }),
      agendarPeloLink(db, pedido(um, "estudio-um", { telefone: "11933334444", nome: "Bia Souza" }), {
        ipHash: "ip-b",
        embaralharTelefone,
        agora: AGORA,
      }),
      agendarPeloLink(db, pedido(um, "estudio-um", { telefone: "11955556666", nome: "Carla Reis" }), {
        ipHash: "ip-c",
        embaralharTelefone,
        agora: AGORA,
      }),
    ]);
    expect(respostas.filter((r) => "ok" in r)).toHaveLength(1);
    expect(respostas.filter((r) => "ocupado" in r && r.ocupado)).toHaveLength(2);
    expect(
      await db.agendamento.count({ where: { usuarioId: um.usuario.id, inicio: sp("2026-10-20T10:00") } }),
    ).toBe(1);
  });

  it("horário que esbarra num atendimento já marcado é recusado na confirmação", async () => {
    const db = await banco();
    await db.agendamento.create({
      data: {
        usuarioId: um.usuario.id,
        clienteId: um.cliente.id,
        servicoId: um.servico.id,
        inicio: sp("2026-10-20T09:30"),
      },
    });
    expect(
      await agendarPeloLink(db, pedido(um, "estudio-um"), { ipHash: "ip", embaralharTelefone, agora: AGORA }),
    ).toEqual({ erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor.", ocupado: true });
    // Fora do horário de atendimento (domingo) e antes da antecedência também.
    expect(
      await agendarPeloLink(db, pedido(um, "estudio-um", { dia: "2026-10-25" }), { ipHash: "ip", embaralharTelefone, agora: AGORA }),
    ).toHaveProperty("ocupado", true);
    expect(
      await agendarPeloLink(db, pedido(um, "estudio-um", { dia: "2026-10-19", hora: "09:00" }), { ipHash: "ip", embaralharTelefone, agora: AGORA }),
    ).toHaveProperty("ocupado", true);
  });

  it("segura o mesmo WhatsApp depois de 5 tentativas na hora", async () => {
    const db = await banco();
    for (let vez = 0; vez < LIMITE_POR_TELEFONE; vez++) {
      // A isca preenchida conta como tentativa e não marca nada.
      const resposta = await agendarPeloLink(db, pedido(um, "estudio-um", { isca: "http://spam" }), {
        ipHash: `ip-${vez}`,
        embaralharTelefone,
        agora: AGORA,
      });
      expect(resposta).toEqual({ erro: "Não deu para confirmar agora. Tente de novo em instantes." });
    }
    const barrada = await agendarPeloLink(db, pedido(um, "estudio-um"), {
      ipHash: "ip-novo",
      embaralharTelefone,
      agora: AGORA,
    });
    expect(barrada).toHaveProperty("erro");
    expect((barrada as { erro: string }).erro).toContain("Esse WhatsApp já tentou marcar várias vezes");
    expect(await db.agendamento.count({ where: { usuarioId: um.usuario.id, origem: "link" } })).toBe(0);

    // Uma hora depois, volta a poder.
    const depois = new Date(AGORA.getTime() + 61 * 60 * 1000);
    expect(
      await agendarPeloLink(db, pedido(um, "estudio-um"), { ipHash: "ip-novo", embaralharTelefone, agora: depois }),
    ).toHaveProperty("ok", true);
  });

  it("segura o mesmo IP depois de 10 tentativas na hora, mesmo trocando o telefone", async () => {
    const db = await banco();
    for (let vez = 0; vez < LIMITE_POR_IP; vez++) {
      await agendarPeloLink(db, pedido(um, "estudio-um", { telefone: `119000000${String(vez).padStart(2, "0")}`, isca: "x" }), {
        ipHash: "mesmo-ip",
        embaralharTelefone,
        agora: AGORA,
      });
    }
    const barrada = await agendarPeloLink(db, pedido(um, "estudio-um"), {
      ipHash: "mesmo-ip",
      embaralharTelefone,
      agora: AGORA,
    });
    expect(barrada).toEqual({ erro: "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo." });
  });

  it("tentativas com mais de um dia são apagadas", async () => {
    const db = await banco();
    await db.tentativaDeAgendamento.create({
      data: { usuarioId: um.usuario.id, ipHash: "velho", criadoEm: new Date(AGORA.getTime() - 25 * 60 * 60 * 1000) },
    });
    await agendarPeloLink(db, pedido(um, "estudio-um"), { ipHash: "ip", embaralharTelefone, agora: AGORA });
    expect(await db.tentativaDeAgendamento.count({ where: { ipHash: "velho" } })).toBe(0);
  });

  it("um estúdio não enxerga nem usa nada do outro", async () => {
    const db = await banco();
    const outro = await montarEstudio("outro");
    await abrirAgenda(outro, "estudio-outro");

    // O outro estúdio tem o dia 20 às 10h ocupado; isso não fecha o horário do primeiro.
    await db.agendamento.create({
      data: {
        usuarioId: outro.usuario.id,
        clienteId: outro.cliente.id,
        servicoId: outro.servico.id,
        inicio: sp("2026-10-20T10:00"),
      },
    });
    const agenda = await abertaOuFalha("estudio-um");
    const [dia] = await horariosOferecidos(db, agenda, agenda.servicos[0], { id: null }, AGORA, "2026-10-20");
    expect(dia.horarios.map((h) => hora(h.inicio))).toContain("10:00");

    // O serviço do outro estúdio não é aceito no link do primeiro.
    expect(
      await agendarPeloLink(db, pedido(um, "estudio-um", { servicoId: outro.servico.id }), {
        ipHash: "ip",
        embaralharTelefone,
        agora: AGORA,
      }),
    ).toEqual({ erro: "Esse serviço não está disponível pelo link. Escolha outro." });

    // O cliente do outro estúdio com o mesmo telefone não é reaproveitado.
    const resposta = await agendarPeloLink(
      db,
      pedido(um, "estudio-um", { telefone: outro.cliente.telefone, nome: "Pessoa Nova" }),
      { ipHash: "ip", embaralharTelefone, agora: AGORA },
    );
    expect(resposta).toHaveProperty("ok", true);
    const marcado = await db.agendamento.findFirstOrThrow({
      where: { usuarioId: um.usuario.id, origem: "link" },
      include: { cliente: true },
    });
    expect(marcado.cliente.usuarioId).toBe(um.usuario.id);
    expect(marcado.clienteId).not.toBe(outro.cliente.id);
    expect(JSON.stringify(resposta)).not.toContain(outro.cliente.nome);

    // E o mesmo endereço não pode ser de dois estúdios.
    expect(
      await salvarConfiguracao(db, outro.usuario.id, {
        link: "estudio-um",
        antecedenciaMin: 0,
        diasAFrente: 30,
        faixas: [],
        servicosIds: [],
        escolherQuemAtende: false,
        donaAtende: true,
      }),
    ).toHaveProperty("erro");

    // A novidade no Início só aparece para o estúdio certo.
    expect(await novosPeloLink(db, outro.usuario.id, AGORA)).toHaveLength(0);
    expect(await novosPeloLink(db, um.usuario.id, AGORA)).toHaveLength(1);
    expect(await marcarNovosComoVistos(db, outro.usuario.id, AGORA)).toBe(0);
    expect(await marcarNovosComoVistos(db, um.usuario.id, AGORA)).toBe(1);
    expect(await novosPeloLink(db, um.usuario.id, AGORA)).toHaveLength(0);
  });

  it("com equipe: respeita quem atende, a ausência e o tanto faz", async () => {
    const db = await banco();
    await limpar();
    const vip = await montarEstudio("vip");
    await abrirAgenda(vip, "estudio-vip", { plano: "vip_mensal" });
    await db.agendaOnline.update({
      where: { usuarioId: vip.usuario.id },
      data: { escolherQuemAtende: true, donaAtende: false },
    });
    const juliana = await db.colaborador.create({
      data: { usuarioId: vip.usuario.id, nome: "Juliana Prado", vinculo: "parceria", inicio: new Date("2026-01-01T00:00:00.000Z") },
    });
    const bianca = await db.colaborador.create({
      data: { usuarioId: vip.usuario.id, nome: "Bianca Rocha", vinculo: "mei", inicio: new Date("2026-01-01T00:00:00.000Z") },
    });
    // Bianca está fora no dia 20; Juliana tem cliente às 10h.
    await db.ausenciaDoColaborador.create({
      data: {
        usuarioId: vip.usuario.id,
        colaboradorId: bianca.id,
        tipo: "indisponivel",
        inicio: new Date("2026-10-20T00:00:00.000Z"),
        fim: new Date("2026-10-20T00:00:00.000Z"),
      },
    });
    await db.agendamento.create({
      data: {
        usuarioId: vip.usuario.id,
        clienteId: vip.cliente.id,
        servicoId: vip.servico.id,
        colaboradorId: juliana.id,
        inicio: sp("2026-10-20T10:00"),
      },
    });

    const agenda = await abertaOuFalha("estudio-vip");
    expect(agenda.escolhe).toBe(true);
    expect(agenda.pessoas.map((p) => p.nome)).toEqual(["Bianca", "Juliana"]);

    const [daBianca] = await horariosOferecidos(db, agenda, agenda.servicos[0], { id: bianca.id }, AGORA, "2026-10-20");
    expect(daBianca.horarios).toEqual([]);
    const [qualquer] = await horariosOferecidos(db, agenda, agenda.servicos[0], { qualquer: true }, AGORA, "2026-10-20");
    expect(qualquer.horarios.map((h) => hora(h.inicio))).not.toContain("10:00");

    // Sem dizer com quem, a página pede.
    expect(
      await agendarPeloLink(db, pedido(vip, "estudio-vip"), { ipHash: "ip", embaralharTelefone, agora: AGORA }),
    ).toEqual({ erro: "Escolha quem vai atender você." });

    // Tanto faz às 11h fica com a Juliana, a única trabalhando no dia.
    const resposta = await agendarPeloLink(
      db,
      pedido(vip, "estudio-vip", { quem: "qualquer", hora: "11:00" }),
      { ipHash: "ip", embaralharTelefone, agora: AGORA },
    );
    expect(resposta).toMatchObject({ ok: true, resumo: { quem: "Juliana" } });
    const marcado = await db.agendamento.findFirstOrThrow({ where: { usuarioId: vip.usuario.id, origem: "link" } });
    expect(marcado.colaboradorId).toBe(juliana.id);

    // Plano sem equipe: a escolha some e tudo vai para a agenda da dona.
    await db.assinatura.update({ where: { usuarioId: vip.usuario.id }, data: { plano: "mensal" } });
    const semEquipe = await abertaOuFalha("estudio-vip");
    expect(semEquipe.escolhe).toBe(false);
    expect(semEquipe.pessoas.map((p) => p.id)).toEqual([null]);
  });
});
