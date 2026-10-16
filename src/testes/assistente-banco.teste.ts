import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import {
  apiEmFila,
  blocoDeFerramenta,
  blocoDeRaciocinio,
  blocoDeTexto,
  fimDaMensagem,
  inicioDaMensagem,
  sse,
} from "./anthropic-falsa";
import type { EventoAssistente, PedidoAoAssistente } from "@/lib/assistente/protocolo";
import { deDataLocal, deDataPura, deHorarioLocal } from "@/lib/formato";
import { AVISO_DE_CORTE, AVISO_DE_VOLTAS, MAX_VOLTAS, MENSAGEM_DE_RECUSA } from "@/lib/ia/assistente";
import {
  aceitarAvisoDaIa,
  apagarConversa,
  apagarConversasParadas,
  ConflitoNaConversa,
  conversaDoUsuario,
  gravarVolta,
  linhasDaConversa,
  listarConversas,
} from "@/lib/ia/conversas";
import { executarFerramenta, FERRAMENTAS } from "@/lib/ia/ferramentas";
import { atenderPedido } from "@/lib/ia/turno";

/**
 * O assistente com banco de verdade e uma API de mentira: o laço conduzido
 * pelo navegador (uma chamada por pedido), a gravação só por acréscimo, a
 * retomada depois de um corte, a franquia reservada uma vez por pergunta e a
 * separação entre estúdios.
 */

const AGORA = new Date("2026-10-16T15:00:00.000Z");
type Estudio = Awaited<ReturnType<typeof montarEstudio>>;
type Mensagem = { role: string; content: unknown };

const SETEMBRO = '{"inicio":"2026-09-01","fim":"2026-09-30"}';

function respostaComFerramenta(id: string, assinatura = "assinatura-1") {
  return () =>
    sse([
      inicioDaMensagem(id),
      ...blocoDeRaciocinio(0, assinatura),
      ...blocoDeFerramenta(1, `tu-${id}`, "resumo_financeiro", SETEMBRO),
      ...fimDaMensagem("tool_use"),
    ]);
}

function respostaFinal(id: string, texto = "Setembro fechou no azul. Próximos passos: abrir aos sábados.") {
  return () => sse([inicioDaMensagem(id), ...blocoDeTexto(0, texto), ...fimDaMensagem("end_turn")]);
}

async function pedir(
  estudio: Estudio,
  pedido: PedidoAoAssistente,
  cliente: Anthropic,
  extra: { limite?: number; signal?: AbortSignal } = {},
) {
  const eventos: EventoAssistente[] = [];
  await atenderPedido({
    db: await banco(),
    estudio: { id: estudio.usuario.id, ramo: "salão de beleza", pixCidade: "Cuiabá" },
    pedido,
    limite: extra.limite ?? 60,
    emitir: (e) => eventos.push(e),
    signal: extra.signal,
    agora: AGORA,
    cliente,
    modelo: "claude-sonnet-5-5",
  });
  const fim = eventos.find((e) => e.tipo === "fim");
  const inicio = eventos.find((e) => e.tipo === "inicio");
  return {
    eventos,
    fim: fim?.tipo === "fim" ? fim : null,
    conversaId: inicio?.tipo === "inicio" ? inicio.conversaId : null,
  };
}

const mensagensDoPedido = (corpo: Record<string, unknown>) => corpo.messages as Mensagem[];

describe.skipIf(!TEM_BANCO)("assistente no banco", () => {
  let ana: Estudio;
  let bia: Estudio;

  beforeEach(async () => {
    await limpar();
    ana = await montarEstudio("ana");
    bia = await montarEstudio("bia");
    const db = await banco();
    // Movimento de setembro só da Ana: R$ 120,00 de atendimento e R$ 50,00 de material.
    await db.agendamento.create({
      data: {
        usuarioId: ana.usuario.id,
        clienteId: ana.cliente.id,
        servicoId: ana.servico.id,
        inicio: deHorarioLocal("2026-09-10T10:00")!,
        status: "concluido",
      },
    });
    await db.lancamento.create({
      data: { usuarioId: ana.usuario.id, tipo: "saida", descricao: "Material", categoria: "Produtos", valorCentavos: 5000, data: deDataLocal("2026-09-12")! },
    });
    // E a Bia tem um valor bem diferente, para o vazamento aparecer se houver.
    await db.lancamento.create({
      data: { usuarioId: bia.usuario.id, tipo: "entrada", descricao: "Curso", valorCentavos: 987654, data: deDataLocal("2026-09-15")! },
    });
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("tool_use → nova volta → end_turn: cada pedido faz uma chamada e grava a sua volta", async () => {
    const db = await banco();
    const { cliente, pedidos } = apiEmFila([respostaComFerramenta("a"), respostaFinal("b")]);

    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
    expect(primeiro.eventos[0]).toMatchObject({ tipo: "inicio", nova: true });
    expect(primeiro.fim).toMatchObject({ salvo: true, continuar: true });
    expect(pedidos).toHaveLength(1);
    const conversaId = primeiro.conversaId!;

    // Gravado: a pergunta, a resposta com o pedido e o resultado da ferramenta.
    let linhas = await linhasDaConversa(db, ana.usuario.id, conversaId);
    expect(linhas.map((l) => l.papel)).toEqual(["user", "assistant", "user"]);
    const resultado = (linhas[2].conteudo as { type: string; content: string }[])[0];
    expect(resultado.type).toBe("tool_result");
    const dados = JSON.parse(resultado.content) as { entradas: { centavos: number }; saidas: { centavos: number } };
    expect(dados.entradas.centavos).toBe(12000);
    expect(dados.saidas.centavos).toBe(5000);
    expect(resultado.content).not.toContain("987654");

    const segundo = await pedir(ana, { acao: "continuar", conversaId }, cliente);
    expect(segundo.fim).toMatchObject({ salvo: true, continuar: false });
    expect(segundo.eventos.filter((e) => e.tipo === "texto").map((e) => (e.tipo === "texto" ? e.delta : "")).join("")).toContain(
      "Setembro fechou",
    );
    expect(pedidos).toHaveLength(2);

    linhas = await linhasDaConversa(db, ana.usuario.id, conversaId);
    expect(linhas.map((l) => l.papel)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(linhas[0].situacao).toBe("concluida");

    // 2º pedido: o raciocínio assinado volta intacto, seguido do resultado.
    const historico = mensagensDoPedido(pedidos[1].corpo);
    expect((historico[1].content as { type: string; signature?: string }[])[0]).toMatchObject({
      type: "thinking",
      signature: "assinatura-1",
    });
    expect(historico.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "tu-a" }] });
    // A data de hoje vai na pergunta, não no sistema.
    expect(JSON.stringify(historico[0])).toContain("16/10/2026");
    expect(String(pedidos[0].corpo.system)).not.toContain("2026");

    // Sistema e ferramentas idênticos entre os pedidos e iguais aos gravados na conversa.
    const conversa = await conversaDoUsuario(db, ana.usuario.id, conversaId);
    expect(pedidos[1].corpo.system).toBe(pedidos[0].corpo.system);
    expect(pedidos[0].corpo.system).toBe(conversa!.sistema);
    expect(JSON.stringify(pedidos[0].corpo.tools)).toBe(conversa!.ferramentas);
    expect(JSON.stringify(pedidos[1].corpo.tools)).toBe(conversa!.ferramentas);
    // A pesquisa sai com a cidade e o país, nunca com o nome do estúdio.
    expect(conversa!.ferramentas).toContain('"city":"Cuiabá"');
    expect(conversa!.ferramentas).not.toContain("Estúdio ana");
    expect(conversa!.sistema).not.toContain("Estúdio ana");

    // Franquia: uma pergunta, uma reserva, com os tokens das duas chamadas.
    const usos = await db.usoDeIa.findMany({ where: { usuarioId: ana.usuario.id } });
    expect(usos).toHaveLength(1);
    expect(usos[0]).toMatchObject({ recurso: "assistente", unidades: 1, tokensEntrada: 200, tokensCacheLeitura: 100 });
  });

  it("pause_turn é uma volta a mais: a retomada termina na resposta do assistente, sem mensagem extra", async () => {
    const { cliente, pedidos } = apiEmFila([
      () =>
        sse([
          inicioDaMensagem("a"),
          ...blocoDeTexto(0, "Vou pesquisar o mercado."),
          ...blocoDeFerramenta(1, "srv1", "web_search", '{"query":"salão de beleza Cuiabá"}', true),
          ...fimDaMensagem("pause_turn"),
        ]),
      respostaFinal("b", "Escova está em alta."),
    ]);
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "O que está em alta?" }, cliente);
    expect(primeiro.fim).toMatchObject({ salvo: true, continuar: true });

    const segundo = await pedir(ana, { acao: "continuar", conversaId: primeiro.conversaId! }, cliente);
    expect(segundo.fim).toMatchObject({ continuar: false });
    const historico = mensagensDoPedido(pedidos[1].corpo);
    expect(historico.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(JSON.stringify(historico[1].content)).toContain("server_tool_use");
  });

  it("recusa: a resposta some, a pergunta sai do histórico e a franquia continua gasta", async () => {
    const db = await banco();
    const { cliente, pedidos } = apiEmFila([
      respostaFinal("a", "Primeira resposta."),
      () => sse([inicioDaMensagem("b"), ...blocoDeTexto(0, "Começo de"), ...fimDaMensagem("refusal")]),
      respostaFinal("c", "Terceira resposta."),
    ]);
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
    const conversaId = primeiro.conversaId!;

    const recusada = await pedir(ana, { acao: "perguntar", conversaId, pergunta: "Pergunta que será recusada" }, cliente);
    expect(recusada.eventos).toContainEqual({ tipo: "recusa", mensagem: MENSAGEM_DE_RECUSA });
    expect(recusada.fim).toMatchObject({ salvo: false, continuar: false });

    const linhas = await linhasDaConversa(db, ana.usuario.id, conversaId);
    const pergunta = linhas.find((l) => l.textoNaTela === "Pergunta que será recusada")!;
    expect(pergunta).toMatchObject({ situacao: "recusada", descartada: true });
    // A volta recusada não foi gravada.
    expect(linhas.filter((l) => l.papel === "assistant")).toHaveLength(1);

    await pedir(ana, { acao: "perguntar", conversaId, pergunta: "E outubro?" }, cliente);
    const historico = JSON.stringify(mensagensDoPedido(pedidos[2].corpo));
    expect(historico).not.toContain("será recusada");
    expect(historico).toContain("Primeira resposta.");

    expect(await db.usoDeIa.count({ where: { usuarioId: ana.usuario.id } })).toBe(3);
  });

  it("max_tokens com ferramenta cortada: não executa, avisa e a próxima pergunta vai sem o tool_use solto", async () => {
    const db = await banco();
    const { cliente, pedidos } = apiEmFila([
      () =>
        sse([
          inicioDaMensagem("a"),
          ...blocoDeTexto(0, "Setembro teve R$ 120,00 de entrada."),
          ...blocoDeFerramenta(1, "tu1", "resumo_financeiro", '{"inicio":"2026-'),
          ...fimDaMensagem("max_tokens"),
        ]),
      respostaFinal("b", "Ok."),
    ]);
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
    expect(primeiro.eventos).toContainEqual({ tipo: "aviso", mensagem: AVISO_DE_CORTE });
    expect(primeiro.fim).toMatchObject({ salvo: true, continuar: false });

    const conversaId = primeiro.conversaId!;
    const linhas = await linhasDaConversa(db, ana.usuario.id, conversaId);
    expect(linhas.map((l) => l.papel)).toEqual(["user", "assistant"]);
    expect(linhas[0].situacao).toBe("cortada");
    expect(linhas[1].textoNaTela).toBe("Setembro teve R$ 120,00 de entrada.");

    await pedir(ana, { acao: "perguntar", conversaId, pergunta: "E outubro?" }, cliente);
    const historico = mensagensDoPedido(pedidos[1].corpo);
    expect(JSON.stringify(historico)).not.toContain('"tool_use"');
    expect(JSON.stringify(historico)).toContain("Setembro teve");
  });

  it("retomada depois de corte: nada da volta cortada fica gravado e a próxima chamada repete o mesmo histórico", async () => {
    const db = await banco();
    const corte = new AbortController();
    const { cliente, pedidos } = apiEmFila([
      respostaComFerramenta("a"),
      // A hospedagem corta o pedido no meio da 2ª volta.
      () => {
        setTimeout(() => corte.abort(), 5);
        return new Promise<Response>((_, rejeitar) =>
          corte.signal.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError"))),
        );
      },
      respostaFinal("c"),
    ]);
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
    const conversaId = primeiro.conversaId!;

    const cortado = await pedir(ana, { acao: "continuar", conversaId }, cliente, { signal: corte.signal });
    expect(cortado.fim).toMatchObject({ salvo: false, continuar: false });
    expect((await linhasDaConversa(db, ana.usuario.id, conversaId)).map((l) => l.papel)).toEqual([
      "user",
      "assistant",
      "user",
    ]);

    const retomado = await pedir(ana, { acao: "continuar", conversaId }, cliente);
    expect(retomado.fim).toMatchObject({ salvo: true, continuar: false });
    // Os bytes do histórico são os mesmos do pedido cortado.
    expect(pedidos[2].corpo.messages).toEqual(pedidos[1].corpo.messages);
    const linhas = await linhasDaConversa(db, ana.usuario.id, conversaId);
    expect(linhas.map((l) => l.papel)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(linhas[0].situacao).toBe("concluida");
    // A franquia não foi reservada de novo na retomada.
    expect(await db.usoDeIa.count({ where: { usuarioId: ana.usuario.id } })).toBe(1);
  });

  it("dois pedidos gravando a mesma volta: o segundo é recusado em vez de embaralhar o histórico", async () => {
    const db = await banco();
    const { cliente } = apiEmFila([respostaComFerramenta("a")]);
    const { conversaId } = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
    const linhas = await linhasDaConversa(db, ana.usuario.id, conversaId!);
    const volta = {
      usuarioId: ana.usuario.id,
      conversaId: conversaId!,
      perguntaId: linhas[0].id,
      ordem: 3,
      resposta: { conteudo: [{ type: "text" as const, text: "A", citations: null }], motivo: "end_turn" },
    };
    await gravarVolta(db, volta);
    await expect(gravarVolta(db, volta)).rejects.toBeInstanceOf(ConflitoNaConversa);
  });

  it("franquia: reservada uma vez por pergunta, na primeira volta; sem saldo, nem chega à API", async () => {
    const db = await banco();
    const { cliente, pedidos } = apiEmFila([respostaComFerramenta("a"), respostaComFerramenta("b"), respostaFinal("c")]);
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente, { limite: 1 });
    await pedir(ana, { acao: "continuar", conversaId: primeiro.conversaId! }, cliente, { limite: 1 });
    const ultimo = await pedir(ana, { acao: "continuar", conversaId: primeiro.conversaId! }, cliente, { limite: 1 });
    expect(ultimo.fim).toMatchObject({ salvo: true, continuar: false, cota: { usados: 1, limite: 1 } });
    expect(pedidos).toHaveLength(3);
    const usos = await db.usoDeIa.findMany({ where: { usuarioId: ana.usuario.id } });
    expect(usos.map((u) => u.unidades)).toEqual([1]);
    expect(usos[0].tokensEntrada).toBe(300);

    const semSaldo = await pedir(
      ana,
      { acao: "perguntar", conversaId: primeiro.conversaId!, pergunta: "E outubro?" },
      cliente,
      { limite: 1 },
    );
    expect(semSaldo.eventos).toContainEqual(expect.objectContaining({ tipo: "erro", codigo: "cota" }));
    expect(pedidos).toHaveLength(3);
  });

  it(`passa de ${MAX_VOLTAS} voltas: para, avisa e não chama mais a API`, async () => {
    const db = await banco();
    const { cliente, pedidos } = apiEmFila(
      Array.from({ length: MAX_VOLTAS }, (_, i) => respostaComFerramenta(`v${i}`, `assinatura-${i}`)),
    );
    const primeiro = await pedir(ana, { acao: "perguntar", pergunta: "Analise tudo" }, cliente);
    let ultimo = primeiro;
    for (let i = 1; i < MAX_VOLTAS; i++) {
      ultimo = await pedir(ana, { acao: "continuar", conversaId: primeiro.conversaId! }, cliente);
    }
    expect(ultimo.eventos).toContainEqual({ tipo: "aviso", mensagem: AVISO_DE_VOLTAS });
    expect(ultimo.fim).toMatchObject({ continuar: false });
    const depois = await pedir(ana, { acao: "continuar", conversaId: primeiro.conversaId! }, cliente);
    expect(depois.fim).toMatchObject({ continuar: false });
    expect(pedidos).toHaveLength(MAX_VOLTAS);
    const linhas = await linhasDaConversa(db, ana.usuario.id, primeiro.conversaId!);
    expect(linhas[0].situacao).toBe("voltas");
  });

  describe("um estúdio não enxerga o outro", () => {
    it("não continua, não pergunta, não lê e não apaga a conversa do outro", async () => {
      const db = await banco();
      const { cliente, pedidos } = apiEmFila([respostaFinal("a", "Resposta só da Ana.")]);
      const { conversaId } = await pedir(ana, { acao: "perguntar", pergunta: "Como foi setembro?" }, cliente);
      expect(pedidos).toHaveLength(1);

      const continuar = await pedir(bia, { acao: "continuar", conversaId: conversaId! }, cliente);
      expect(continuar.eventos).toContainEqual(expect.objectContaining({ tipo: "erro", codigo: "nao_encontrada" }));
      const perguntar = await pedir(bia, { acao: "perguntar", conversaId: conversaId!, pergunta: "Oi" }, cliente);
      expect(perguntar.eventos).toContainEqual(expect.objectContaining({ tipo: "erro", codigo: "nao_encontrada" }));
      expect(pedidos).toHaveLength(1);
      // Nem a franquia da Bia foi tocada.
      expect(await db.usoDeIa.count({ where: { usuarioId: bia.usuario.id } })).toBe(0);

      expect(await listarConversas(db, bia.usuario.id)).toEqual([]);
      expect(await conversaDoUsuario(db, bia.usuario.id, conversaId!)).toBeNull();
      expect(await linhasDaConversa(db, bia.usuario.id, conversaId!)).toEqual([]);
      expect(await db.mensagemDeIa.findFirst({ where: { conversaId: conversaId!, usuarioId: bia.usuario.id } })).toBeNull();

      expect(await apagarConversa(db, bia.usuario.id, conversaId!)).toBe(false);
      expect(await conversaDoUsuario(db, ana.usuario.id, conversaId!)).not.toBeNull();
      expect(await apagarConversa(db, ana.usuario.id, conversaId!)).toBe(true);
      // As mensagens saem junto com a conversa.
      expect(await db.mensagemDeIa.count({ where: { conversaId: conversaId! } })).toBe(0);
    });

    it("as ferramentas leem só o estúdio da sessão", async () => {
      const db = await banco();
      const ctx = { db, usuarioId: bia.usuario.id, hoje: "2026-10-16" };
      const resultado = await executarFerramenta(
        { id: "t1", name: "resumo_financeiro", input: { inicio: "2026-09-01", fim: "2026-09-30" } },
        ctx,
      );
      const dados = JSON.parse(String(resultado.content)) as { entradas: { centavos: number }; saidas: { centavos: number } };
      expect(dados.entradas.centavos).toBe(987654);
      expect(dados.saidas.centavos).toBe(0);
    });
  });

  it("nenhuma ferramenta devolve nome, contato, CPF, observação de cliente nem valor de uma pessoa da equipe", async () => {
    const db = await banco();
    const id = ana.usuario.id;
    await db.cliente.update({
      where: { id: ana.cliente.id },
      data: {
        nome: "Júlia Conceição",
        telefone: "66992513501",
        email: "julia.conceicao@exemplo.com.br",
        cpf: "52998224725",
        observacoes: "Alergia a amônia",
      },
    });
    await db.agendamento.updateMany({ where: { usuarioId: id }, data: { observacoes: "Pediu Juliana" } });
    const rafael = await db.colaborador.create({
      data: {
        usuarioId: id,
        nome: "Rafael Lima",
        vinculo: "clt",
        inicio: deDataPura("2026-01-05")!,
        salarioCentavos: 231700,
        documento: "11144477735",
        pixChave: "rafael.lima@exemplo.com.br",
      },
    });
    const lancamento = await db.lancamento.create({
      data: {
        usuarioId: id,
        tipo: "saida",
        descricao: "Salário — Rafael L.",
        categoria: "Salários e encargos",
        valorCentavos: 231700,
        data: deDataLocal("2026-09-05")!,
      },
    });
    await db.pagamentoDeColaborador.create({
      data: {
        usuarioId: id,
        colaboradorId: rafael.id,
        tipo: "salario",
        competencia: "2026-09",
        valorCentavos: 231700,
        pagoEm: deDataPura("2026-09-05")!,
        lancamentoId: lancamento.id,
      },
    });
    await db.lancamento.create({
      data: {
        usuarioId: id,
        tipo: "saida",
        descricao: "Presente para Júlia Conceição, CPF 529.982.247-25",
        categoria: "Presente Julia",
        valorCentavos: 8000,
        data: deDataLocal("2026-09-20")!,
      },
    });
    await db.cobranca.create({
      data: { usuarioId: id, clienteId: ana.cliente.id, valorCentavos: 15000, vencimento: deDataPura("2026-10-01")! },
    });
    await db.vencimento.create({
      data: { usuarioId: id, descricao: "Aluguel da Júlia", valorCentavos: 180000, data: deDataPura("2026-10-20")! },
    });

    const ctx = { db, usuarioId: id, hoje: "2026-10-16" };
    const entradas: Record<string, unknown> = {
      resumo_financeiro: { inicio: "2026-09-01", fim: "2026-09-30" },
      desempenho_dos_servicos: { inicio: "2026-07-01", fim: "2026-10-16" },
      agenda_e_ocupacao: { inicio: "2026-07-01", fim: "2026-10-16" },
      clientes_em_numeros: { inicio: "2026-07-01", fim: "2026-10-16" },
      cobrancas_e_vencimentos: {},
      custos_operacionais: { mes: "2026-09" },
      equipe_em_numeros: { mes: "2026-09" },
    };
    expect(Object.keys(entradas).sort()).toEqual(FERRAMENTAS.map((f) => f.nome).sort());

    const saidas: Record<string, string> = {};
    for (const [nome, input] of Object.entries(entradas)) {
      const resultado = await executarFerramenta({ id: nome, name: nome, input }, ctx);
      expect(resultado.is_error, `${nome}: ${String(resultado.content)}`).toBeFalsy();
      saidas[nome] = String(resultado.content);
    }
    const tudo = Object.values(saidas).join("\n");
    for (const proibido of [
      "Júlia",
      "Julia",
      "Conceição",
      "Juliana",
      "Rafael",
      "Lima",
      "66992513501",
      "julia.conceicao",
      "52998224725",
      "529.982.247-25",
      "11144477735",
      "amônia",
      "Alergia",
      "Aluguel da",
      ana.cliente.id,
      rafael.id,
    ]) {
      expect(tudo, `vazou "${proibido}"`).not.toContain(proibido);
    }

    // Os números continuam lá: totais por categoria e por tipo, nunca por pessoa.
    const financeiro = JSON.parse(saidas.resumo_financeiro) as { maiores_categorias_de_saida: { categoria: string }[] };
    expect(financeiro.maiores_categorias_de_saida.map((c) => c.categoria)).toContain("Salários e encargos");
    expect(financeiro.maiores_categorias_de_saida.map((c) => c.categoria)).toContain("Presente [nome]");
    const equipe = JSON.parse(saidas.equipe_em_numeros) as { colaboradores_ativos_no_mes: number; total_pago_a_equipe: { centavos: number } };
    expect(equipe).toMatchObject({ colaboradores_ativos_no_mes: 1, total_pago_a_equipe: { centavos: 231700 } });
    const cobrancas = JSON.parse(saidas.cobrancas_e_vencimentos) as {
      a_receber: { atrasado: { centavos: number } };
      a_pagar: { vence_nos_proximos_30_dias: { centavos: number } };
    };
    expect(cobrancas.a_receber.atrasado.centavos).toBe(27000);
    expect(cobrancas.a_pagar.vence_nos_proximos_30_dias.centavos).toBe(180000);
  });

  it("entrada fora do formato e período de mais de 24 meses voltam como erro para o modelo, sem consultar", async () => {
    const db = await banco();
    const ctx = { db, usuarioId: ana.usuario.id, hoje: "2026-10-16" };
    const longo = await executarFerramenta(
      { id: "t", name: "resumo_financeiro", input: { inicio: "2024-01-01", fim: "2026-10-16" } },
      ctx,
    );
    expect(longo).toMatchObject({ is_error: true });
    expect(String(longo.content)).toContain("24 meses");
    const estranha = await executarFerramenta({ id: "t", name: "apagar_tudo", input: {} }, ctx);
    expect(estranha).toMatchObject({ is_error: true });
    // O estúdio vem do servidor: um usuarioId na entrada do modelo é ignorado.
    const intrusa = await executarFerramenta(
      { id: "t", name: "resumo_financeiro", input: { inicio: "2026-09-01", fim: "2026-09-30", usuarioId: bia.usuario.id } },
      ctx,
    );
    expect(String(intrusa.content)).not.toContain("987654");
  });

  it("retenção: apaga só as conversas paradas há mais de 90 dias, e só do próprio estúdio", async () => {
    const db = await banco();
    const criar = (usuarioId: string, titulo: string) =>
      db.conversaDeIa.create({ data: { usuarioId, titulo, sistema: "s", ferramentas: "[]" }, select: { id: true } });
    const velhaDaAna = await criar(ana.usuario.id, "velha");
    const novaDaAna = await criar(ana.usuario.id, "nova");
    const velhaDaBia = await criar(bia.usuario.id, "velha");
    const antigo = new Date(AGORA.getTime() - 91 * 86_400_000);
    await db.$executeRaw`UPDATE "ConversaDeIa" SET "atualizadoEm" = ${antigo} WHERE id IN (${velhaDaAna.id}, ${velhaDaBia.id})`;

    expect(await apagarConversasParadas(db, ana.usuario.id, AGORA)).toBe(1);
    expect(await conversaDoUsuario(db, ana.usuario.id, velhaDaAna.id)).toBeNull();
    expect(await conversaDoUsuario(db, ana.usuario.id, novaDaAna.id)).not.toBeNull();
    expect(await conversaDoUsuario(db, bia.usuario.id, velhaDaBia.id)).not.toBeNull();
  });

  it("aceite do aviso: grava a data uma vez e não muda em um segundo clique", async () => {
    const db = await banco();
    await aceitarAvisoDaIa(db, ana.usuario.id, new Date("2026-10-01T12:00:00Z"));
    await aceitarAvisoDaIa(db, ana.usuario.id, new Date("2026-10-02T12:00:00Z"));
    const usuario = await db.usuario.findUnique({ where: { id: ana.usuario.id }, select: { iaAceitaEm: true } });
    expect(usuario?.iaAceitaEm?.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    const bia2 = await db.usuario.findUnique({ where: { id: bia.usuario.id }, select: { iaAceitaEm: true } });
    expect(bia2?.iaAceitaEm).toBeNull();
  });
});
