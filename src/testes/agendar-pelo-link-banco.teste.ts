import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import {
  agendarPeloLink,
  carregarAgendaPublica,
  horariosOferecidos,
  ligarAgendaOnline,
  lerPedidoDePessoa,
  salvarConfiguracao,
} from "@/lib/agendamento-online/operacoes";
import { LINK_DO_EXEMPLO } from "@/lib/demonstracao/dados";
import { refazerEstudioDeExemplo } from "@/lib/demonstracao/estudio";
import { ID_DO_ESTUDIO_DE_EXEMPLO } from "@/lib/demonstracao/conta";
import { hora, paraDataLocal, somarDias } from "@/lib/formato";

/**
 * A confirmação da página pública, pela própria ação do Next.
 *
 * O defeito que este teste segura: a ação gravava o horário e depois pedia
 * para o Next revalidar telas do painel. No Next 16, qualquer revalidação (ou
 * cookie gravado) dentro de uma ação faz a resposta trazer a página ATUAL
 * montada de novo. A página pública, montada de novo, já via o horário
 * ocupado, tirava o formulário da tela e a cliente lia "Esse horário não está
 * mais livre" em vez de "Horário marcado". O horário estava gravado; a cliente
 * achava que não, e marcava outro.
 *
 * As telas do painel são dinâmicas e leem o banco a cada visita: não precisam
 * de revalidação nenhuma para mostrar o horário novo.
 */

const espioes = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  cookiesSet: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: espioes.revalidatePath,
  revalidateTag: espioes.revalidateTag,
  updateTag: espioes.updateTag,
  refresh: espioes.refresh,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "200.100.50.25" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: espioes.cookiesSet }),
}));

const LINK = "estudio-link-confirmacao";

/** Um dia útil daqui a uns dias, às 10h: sempre dentro da janela de 30 dias. */
function diaUtilAFrente() {
  let dia = somarDias(new Date(), 3);
  while ([0, 6].includes(new Date(`${paraDataLocal(dia)}T12:00:00-03:00`).getUTCDay())) {
    dia = somarDias(dia, 1);
  }
  return paraDataLocal(dia);
}

describe.skipIf(!TEM_BANCO)("confirmar horário pelo link (ação do Next)", () => {
  beforeEach(async () => {
    await limpar();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("grava, devolve o resumo e não pede para o Next montar a página de novo", async () => {
    const db = await banco();
    const estudio = await montarEstudio("confirmacao");
    await db.assinatura.create({
      data: {
        usuarioId: estudio.usuario.id,
        status: "ativa",
        plano: "mensal",
        validaAte: new Date(Date.now() + 60 * 86_400_000),
      },
    });
    const faixas = [1, 2, 3, 4, 5].map((diaDaSemana) => ({ diaDaSemana, inicioMin: 540, fimMin: 1080 }));
    expect(
      await salvarConfiguracao(db, estudio.usuario.id, {
        link: LINK,
        antecedenciaMin: 120,
        diasAFrente: 30,
        faixas,
        servicosIds: [estudio.servico.id],
        escolherQuemAtende: false,
        donaAtende: true,
      }),
    ).toEqual({ ok: true });
    expect(await ligarAgendaOnline(db, estudio.usuario.id, true)).toEqual({ ok: true });

    const { confirmarHorario } = await import("@/app/agendar/[link]/acoes");
    const dia = diaUtilAFrente();
    const dados = new FormData();
    dados.set("link", LINK);
    dados.set("servico", estudio.servico.id);
    dados.set("quem", "");
    dados.set("dia", dia);
    dados.set("hora", "10:00");
    dados.set("nome", "Larissa Moura");
    dados.set("telefone", "(11) 96666-5555");
    dados.set("site", "");

    const resposta = await confirmarHorario(null, dados);

    expect(resposta).toMatchObject({ ok: true, resumo: { primeiroNome: "Larissa" } });
    const gravados = await db.agendamento.findMany({
      where: { usuarioId: estudio.usuario.id, origem: "link" },
    });
    expect(gravados).toHaveLength(1);
    expect(paraDataLocal(gravados[0].inicio)).toBe(dia);

    // Nada que faça a resposta da ação trazer a página montada de novo.
    expect(espioes.revalidatePath).not.toHaveBeenCalled();
    expect(espioes.revalidateTag).not.toHaveBeenCalled();
    expect(espioes.updateTag).not.toHaveBeenCalled();
    expect(espioes.refresh).not.toHaveBeenCalled();
    expect(espioes.cookiesSet).not.toHaveBeenCalled();
  });

  it("o link do estúdio de exemplo mostra os passos, mas não grava nada", async () => {
    const db = await banco();
    const agora = new Date();
    await refazerEstudioDeExemplo(db, agora, true);

    const pagina = await carregarAgendaPublica(db, LINK_DO_EXEMPLO, agora);
    if (pagina.situacao !== "demonstracao") throw new Error(`Esperava demonstração, veio ${pagina.situacao}`);
    const { agenda } = pagina;
    expect(agenda.servicos.length).toBeGreaterThan(0);
    expect(agenda.escolhe).toBe(true);

    // Dá para escolher serviço, pessoa e dia, como a cliente faria.
    const pedido = lerPedidoDePessoa(agenda, "qualquer")!;
    const dias = await horariosOferecidos(db, agenda, agenda.servicos[0], pedido, agora);
    const comHorario = dias.filter((dia) => dia.horarios.length > 0);
    expect(comHorario.length).toBeGreaterThan(0);

    const antes = await db.agendamento.count({ where: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO } });
    const resposta = await agendarPeloLink(
      db,
      {
        link: LINK_DO_EXEMPLO,
        servicoId: agenda.servicos[0].id,
        quem: "qualquer",
        dia: comHorario[0].dia,
        hora: hora(comHorario[0].horarios[0].inicio),
        nome: "Visitante",
        telefone: "11987654321",
        isca: "",
      },
      { ipHash: "ip", embaralharTelefone: (telefone) => telefone },
    );
    expect("erro" in resposta).toBe(true);
    expect(await db.agendamento.count({ where: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO } })).toBe(antes);
    expect(await db.tentativaDeAgendamento.count()).toBe(0);
  });
});
