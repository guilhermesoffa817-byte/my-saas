import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEM_BANCO, banco, limpar } from "./banco";
import {
  DESTINO_DA_DEMONSTRACAO,
  EMAIL_DO_ESTUDIO_DE_EXEMPLO,
  ID_DO_ESTUDIO_DE_EXEMPLO,
} from "@/lib/demonstracao/conta";
import { LINK_DO_EXEMPLO } from "@/lib/demonstracao/dados";
import { estudioDeExemplo, refazerEstudioDeExemplo } from "@/lib/demonstracao/estudio";
import { agendarPeloLink, carregarAgendaPublica } from "@/lib/agendamento-online/operacoes";
import { abrirPeloCodigo, gerarCodigo, resumoDoCodigo } from "@/lib/contador/operacoes";

/**
 * A demonstração com banco de verdade.
 *
 * O ponto principal: quem está na demonstração vê o estúdio de exemplo, mas
 * TODA ação de escrita manda para a assinatura e não muda nada nele. O teste
 * chama cada ação exportada do painel (descobertas no disco, então ação nova
 * entra sozinha) e confere, linha por linha, que o estúdio de exemplo ficou
 * exatamente igual e que nada foi gravado na conta de quem tentou.
 */

/* ------------------------------------------------- o que o Next faria */

class Redirecionou extends Error {
  constructor(public destino: string) {
    super(`redirect: ${destino}`);
  }
}

const sessao = vi.hoisted(() => ({ usuario: null as unknown }));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
}));
// A sessão é o único ponto trocado: o resto (guardas, ações, Prisma) é o de verdade.
vi.mock("@/lib/sessao", () => ({
  usuarioAtual: async () => sessao.usuario,
  criarSessao: async () => undefined,
  encerrarSessao: async () => undefined,
}));

/* --------------------------------------------------------- utilidades */

const PASTA_DO_PAINEL = join(__dirname, "..", "app", "painel");

/** Todos os arquivos de ação do painel, menos administração e o aviso de Pix. */
function arquivosDeAcao(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeAcao(caminho);
    return nome === "acoes.ts" ? [caminho] : [];
  });
}

const FORA_DA_VARREDURA = [/[\\/]admin[\\/]acoes\.ts$/, /[\\/]assinatura[\\/]acoes\.ts$/];

/** Uma foto de tudo o que é do estúdio de exemplo, para comparar antes e depois. */
async function fotoDoExemplo() {
  const db = await banco();
  const de = { where: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO }, orderBy: { id: "asc" as const } };
  const partes = {
    usuario: await db.usuario.findUnique({
      where: { id: ID_DO_ESTUDIO_DE_EXEMPLO },
      include: { assinatura: true },
    }),
    clientes: await db.cliente.findMany(de),
    servicos: await db.servico.findMany(de),
    agendamentos: await db.agendamento.findMany(de),
    lancamentos: await db.lancamento.findMany(de),
    cobrancas: await db.cobranca.findMany(de),
    lembretes: await db.lembreteDeCobranca.findMany({
      where: { cobranca: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO } },
      orderBy: { id: "asc" },
    }),
    vencimentos: await db.vencimento.findMany(de),
    repeticoes: await db.repeticaoDeVencimento.findMany(de),
    documentos: await db.documento.findMany(de),
    itens: await db.itemDoDocumento.findMany({
      where: { documento: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO } },
      orderBy: { id: "asc" },
    }),
    colaboradores: await db.colaborador.findMany(de),
    ausencias: await db.ausenciaDoColaborador.findMany(de),
    pagamentosDaEquipe: await db.pagamentoDeColaborador.findMany(de),
    usosDeIa: await db.usoDeIa.findMany(de),
    conversas: await db.conversaDeIa.findMany(de),
    mensagens: await db.mensagemDeIa.findMany(de),
    agendaOnline: await db.agendaOnline.findMany(de),
    faixas: await db.faixaDeAtendimento.findMany(de),
    tentativas: await db.tentativaDeAgendamento.findMany(de),
    fechamentos: await db.fechamentoDoMes.findMany(de),
    registros: await db.registroDeFechamento.findMany(de),
    acessos: await db.acessoDoContador.findMany(de),
    pagamentos: await db.pagamento.findMany(de),
    pedidosDeSenha: await db.pedidoDeSenha.findMany(de),
  };
  const texto = JSON.stringify(partes, (_chave, valor) =>
    typeof valor === "bigint" ? valor.toString() : valor,
  );
  return { partes, resumo: createHash("sha256").update(texto).digest("hex") };
}

/** Quantas linhas a conta tem em cada tabela que uma ação poderia tocar. */
async function linhasDa(usuarioId: string) {
  const db = await banco();
  const onde = { where: { usuarioId } };
  return {
    clientes: await db.cliente.count(onde),
    servicos: await db.servico.count(onde),
    agendamentos: await db.agendamento.count(onde),
    lancamentos: await db.lancamento.count(onde),
    cobrancas: await db.cobranca.count(onde),
    vencimentos: await db.vencimento.count(onde),
    documentos: await db.documento.count(onde),
    colaboradores: await db.colaborador.count(onde),
    conversas: await db.conversaDeIa.count(onde),
    agendaOnline: await db.agendaOnline.count(onde),
    fechamentos: await db.fechamentoDoMes.count(onde),
    acessos: await db.acessoDoContador.count(onde),
    usosDeIa: await db.usoDeIa.count(onde),
  };
}

async function novaConta(apelido: string, assinatura: { status: string; plano?: string; validaAte: Date }) {
  const db = await banco();
  return db.usuario.create({
    data: {
      nome: `Pessoa ${apelido}`,
      email: `${apelido}@teste.com.br`,
      senhaHash: "x",
      nomeNegocio: `Estúdio ${apelido}`,
      assinatura: { create: assinatura },
    },
    include: { assinatura: true },
  });
}

/** Um formulário cheio de ids do estúdio de exemplo, como um visitante mal-intencionado mandaria. */
function formularioComIdsDoExemplo() {
  const dados = new FormData();
  const campos: Record<string, string> = {
    id: "exemplo-cobranca-hoje-1",
    clienteId: "exemplo-cliente-1",
    cliente: "exemplo-cliente-1",
    servicoId: "exemplo-servico-corte",
    servico: "exemplo-servico-corte",
    colaboradorId: "exemplo-colaborador-paula",
    documentoId: "exemplo-documento-contrato",
    lancamentoId: "exemplo-sem-classe-1",
    usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO,
    status: "concluido",
    nome: "Visitante",
    telefone: "11987654321",
    descricao: "Teste",
    valor: "100,00",
    data: "2026-10-16",
    inicio: "2026-10-16T10:00",
    mes: "2026-09",
    natureza: "fixo",
    tipo: "saida",
    forma: "pix",
    percentual: "10",
    ramo: "salão",
    link: LINK_DO_EXEMPLO,
  };
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

/* -------------------------------------------------------------- testes */

// Com a IA ligada o exemplo mostra tudo; o caso sem IA está em dados.teste.ts.
const COM_IA = { ia: true, documentos: true };

describe.skipIf(!TEM_BANCO)("demonstração", () => {
  const AGORA = new Date();

  beforeAll(async () => {
    await limpar();
    await refazerEstudioDeExemplo(await banco(), AGORA, true, COM_IA);
  });

  beforeEach(() => {
    sessao.usuario = null;
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("monta o estúdio de exemplo com tudo preenchido", async () => {
    const linhas = await linhasDa(ID_DO_ESTUDIO_DE_EXEMPLO);
    for (const [tabela, quantas] of Object.entries(linhas)) {
      expect(quantas, tabela).toBeGreaterThan(0);
    }
  });

  it("não refaz os dados enquanto estão frescos, e refaz quando ficam velhos", async () => {
    const db = await banco();
    const antes = await estudioDeExemplo(db, AGORA, COM_IA);
    const deNovo = await estudioDeExemplo(db, new Date(AGORA.getTime() + 60_000), COM_IA);
    expect(deNovo.criadoEm.getTime()).toBe(antes.criadoEm.getTime());

    const depois = new Date(AGORA.getTime() + 13 * 3_600_000);
    const refeito = await estudioDeExemplo(db, depois, COM_IA);
    expect(refeito.criadoEm.getTime()).toBe(depois.getTime());

    // A IA saiu do servidor: refaz na hora, mesmo com os dados frescos.
    const semIa = await estudioDeExemplo(db, new Date(depois.getTime() + 60_000), { ia: false, documentos: false });
    expect(semIa.iaAceitaEm).toBeNull();
    expect(await db.documento.count({ where: { usuarioId: semIa.id } })).toBe(0);
    expect(await db.lancamento.count({ where: { usuarioId: semIa.id, naturezaOrigem: "ia" } })).toBe(0);

    // Volta para "agora", para os outros testes verem a agenda de hoje.
    await refazerEstudioDeExemplo(db, AGORA, true, COM_IA);
  });

  it("dois visitantes ao mesmo tempo: refaz uma vez só, sem duplicar nada", async () => {
    const db = await banco();
    await db.usuario.update({
      where: { id: ID_DO_ESTUDIO_DE_EXEMPLO },
      data: { criadoEm: new Date(AGORA.getTime() - 2 * 86_400_000) },
    });
    const contagemEsperada = await linhasDa(ID_DO_ESTUDIO_DE_EXEMPLO);

    const resultados = await Promise.all([
      refazerEstudioDeExemplo(db, AGORA, false, COM_IA),
      refazerEstudioDeExemplo(db, AGORA, false, COM_IA),
      refazerEstudioDeExemplo(db, AGORA, false, COM_IA),
    ]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await linhasDa(ID_DO_ESTUDIO_DE_EXEMPLO)).toEqual(contagemEsperada);
  });

  it("na demonstração, a tela recebe o estúdio de exemplo; depois do Pix, a própria conta", async () => {
    const { exigirLeitura } = await import("@/lib/guardas");
    const conta = await novaConta("leitura", { status: "demonstracao", validaAte: AGORA });
    sessao.usuario = conta;

    const naDemonstracao = await exigirLeitura();
    expect(naDemonstracao.demonstracao).toBe(true);
    expect(naDemonstracao.usuario.id).toBe(ID_DO_ESTUDIO_DE_EXEMPLO);

    // A administração confirmou o Pix: a assinatura vira "ativa".
    const db = await banco();
    sessao.usuario = await db.usuario.update({
      where: { id: conta.id },
      data: { assinatura: { update: { status: "ativa", plano: "mensal", validaAte: new Date(AGORA.getTime() + 30 * 86_400_000) } } },
      include: { assinatura: true },
    });
    const depoisDoPix = await exigirLeitura();
    expect(depoisDoPix.demonstracao).toBe(false);
    expect(depoisDoPix.usuario.id).toBe(conta.id);
    // Começa vazia: nenhum dado de exemplo misturado.
    expect(Object.values(await linhasDa(conta.id)).every((n) => n === 0)).toBe(true);
  });

  it("quem ainda está no teste antigo usa os próprios dados; quem já pagou e venceu vai para a assinatura", async () => {
    const { exigirLeitura } = await import("@/lib/guardas");

    sessao.usuario = await novaConta("teste-antigo", {
      status: "teste",
      validaAte: new Date(AGORA.getTime() + 86_400_000),
    });
    const leitura = await exigirLeitura();
    expect(leitura.demonstracao).toBe(false);
    expect(leitura.usuario.id).toBe((sessao.usuario as { id: string }).id);

    sessao.usuario = await novaConta("vencida", {
      status: "ativa",
      validaAte: new Date(AGORA.getTime() - 86_400_000),
    });
    await expect(exigirLeitura()).rejects.toMatchObject({ destino: "/painel/assinatura" });
  });

  it("toda ação do painel, na demonstração, vai para a assinatura e não muda nada", async () => {
    const conta = await novaConta("visitante", { status: "demonstracao", validaAte: AGORA });
    sessao.usuario = conta;
    const antes = await fotoDoExemplo();

    const arquivos = arquivosDeAcao(PASTA_DO_PAINEL).filter(
      (caminho) => !FORA_DA_VARREDURA.some((padrao) => padrao.test(caminho)),
    );
    expect(arquivos.length).toBeGreaterThan(10);

    const conferidas: string[] = [];
    for (const arquivo of arquivos) {
      const modulo = (await import(arquivo)) as Record<string, unknown>;
      for (const [nome, acao] of Object.entries(modulo)) {
        if (typeof acao !== "function") continue;
        const dados = formularioComIdsDoExemplo();
        // Os dois jeitos de chamar: acao(dados) e acao(estadoAnterior, dados).
        const chamada = (acao as (...args: unknown[]) => Promise<unknown>)(dados, dados);
        await expect(chamada, `${arquivo} → ${nome}`).rejects.toMatchObject({
          destino: DESTINO_DA_DEMONSTRACAO,
        });
        conferidas.push(nome);
      }
    }

    // As ações mais importantes estão mesmo na lista conferida.
    for (const nome of [
      "marcarHorario",
      "mudarStatus",
      "excluirAgendamento",
      "salvarCliente",
      "excluirCliente",
      "salvarServico",
      "criarCobranca",
      "marcarComoPaga",
      "cancelarCobranca",
      "registrarLembrete",
      "salvarLancamento",
      "excluirLancamento",
      "salvarImposto",
      "salvarVencimento",
      "marcarComoPago",
      "pedirEnvio",
      "aceitarItem",
      "excluirDocumento",
      "salvarColaboradorAcao",
      "registrarPagamentoAcao",
      "corrigirNatureza",
      "sugerirClassificacao",
      "fecharMesAcao",
      "reabrirMesAcao",
      "gerarLinkDoContador",
      "revogarLinkDoContador",
      "salvarAgendaOnline",
      "ligarOuDesligar",
      "marcarNovosVistos",
      "aceitarAviso",
      "apagarConversa",
      "salvarRamo",
    ]) {
      expect(conferidas, nome).toContain(nome);
    }

    const depois = await fotoDoExemplo();
    expect(depois.resumo).toBe(antes.resumo);
    // E nada foi parar na conta de quem tentou.
    expect(Object.values(await linhasDa(conta.id)).every((n) => n === 0)).toBe(true);
  }, 60_000);

  it("as rotas de API respondem com o destino da assinatura, sem chamar a IA", async () => {
    sessao.usuario = await novaConta("api", { status: "demonstracao", validaAte: AGORA });
    const antes = await fotoDoExemplo();

    const assistente = await import("@/app/api/assistente/route");
    const respostaDoAssistente = await assistente.POST(
      new Request("http://localhost/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "perguntar", pergunta: "Como foi meu mês?" }),
      }),
    );
    expect(respostaDoAssistente.status).toBe(403);
    expect(await respostaDoAssistente.json()).toMatchObject({
      codigo: "demonstracao",
      destino: DESTINO_DA_DEMONSTRACAO,
    });

    const leitura = await import("@/app/api/documentos/[id]/ler/route");
    const respostaDaLeitura = await leitura.POST(
      new Request("http://localhost/api/documentos/exemplo-documento-contrato/ler", { method: "POST" }),
      { params: Promise.resolve({ id: "exemplo-documento-contrato" }) },
    );
    expect(respostaDaLeitura.status).toBe(403);
    expect(await respostaDaLeitura.json()).toMatchObject({ destino: DESTINO_DA_DEMONSTRACAO });

    expect((await fotoDoExemplo()).resumo).toBe(antes.resumo);
  });

  it("quem já assina grava na própria conta, nunca na de exemplo", async () => {
    const conta = await novaConta("assinante", {
      status: "ativa",
      plano: "mensal",
      validaAte: new Date(AGORA.getTime() + 30 * 86_400_000),
    });
    sessao.usuario = conta;
    const antes = await fotoDoExemplo();

    const { salvarServico } = await import("@/app/painel/servicos/acoes");
    const dados = new FormData();
    dados.set("nome", "Escova progressiva");
    dados.set("preco", "180,00");
    dados.set("duracaoMin", "120");
    dados.set("usuarioId", ID_DO_ESTUDIO_DE_EXEMPLO);
    expect(await salvarServico(null, dados)).toMatchObject({ recado: expect.any(String) });

    const db = await banco();
    expect(await db.servico.count({ where: { usuarioId: conta.id } })).toBe(1);
    expect((await fotoDoExemplo()).resumo).toBe(antes.resumo);

    // O Simples não abre ação do Completo: vai para os planos.
    const { salvarVencimento } = await import("@/app/painel/vencimentos/acoes");
    await expect(salvarVencimento(null, new FormData())).rejects.toMatchObject({
      destino: "/painel/assinatura?completo=1",
    });
  });

  it("avisar o Pix na demonstração grava o pagamento na conta da pessoa", async () => {
    const conta = await novaConta("pix", { status: "demonstracao", validaAte: AGORA });
    sessao.usuario = conta;
    const { avisarPagamento } = await import("@/app/painel/assinatura/acoes");
    const dados = new FormData();
    dados.set("plano", "vip_anual");
    const resposta = await avisarPagamento(null, dados);
    expect(resposta?.recado).toBeTruthy();

    const db = await banco();
    const pagamento = await db.pagamento.findFirst({ where: { usuarioId: conta.id } });
    expect(pagamento?.valorCentavos).toBe(256900);
    expect(await db.pagamento.count({ where: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO } })).toBe(0);
  });

  it("a página pública do link de exemplo não aceita horário nem grava tentativa", async () => {
    const db = await banco();
    const pagina = await carregarAgendaPublica(db, LINK_DO_EXEMPLO, AGORA);
    expect(pagina.situacao).toBe("demonstracao");

    const resposta = await agendarPeloLink(
      db,
      {
        link: LINK_DO_EXEMPLO,
        servicoId: "exemplo-servico-corte",
        quem: "",
        dia: "2026-10-20",
        hora: "10:00",
        nome: "Visitante",
        telefone: "11987654321",
        isca: "",
      },
      { ipHash: "ip", embaralharTelefone: (telefone) => telefone },
    );
    expect("erro" in resposta).toBe(true);
    expect(await db.tentativaDeAgendamento.count()).toBe(0);
  });

  it("o link do contador nunca abre o estúdio de exemplo", async () => {
    const db = await banco();
    const codigo = gerarCodigo();
    await db.acessoDoContador.create({
      data: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO, codigoHash: resumoDoCodigo(codigo) },
    });
    const abertura = await abrirPeloCodigo(db, codigo, "ip-do-contador", AGORA);
    expect(abertura.situacao).toBe("nao_encontrado");
  });

  it("ninguém entra na conta de exemplo nem cria conta com o e-mail dela", async () => {
    const { entrar, criarConta } = await import("@/app/acoes/autenticacao");
    const login = new FormData();
    login.set("email", EMAIL_DO_ESTUDIO_DE_EXEMPLO);
    login.set("senha", "conta-de-exemplo-sem-senha");
    expect(await entrar(null, login)).toMatchObject({ erro: expect.any(String) });

    const cadastro = new FormData();
    for (const [campo, valor] of Object.entries({
      nome: "Alguém",
      nomeNegocio: "Estúdio",
      email: EMAIL_DO_ESTUDIO_DE_EXEMPLO,
      telefone: "11987654321",
      documento: "11222333000181",
      senha: "senha-bem-longa",
    })) {
      cadastro.set(campo, valor);
    }
    expect(await criarConta(null, cadastro)).toMatchObject({ erro: expect.any(String) });
  });

  it("conta nova nasce na demonstração, sem teste grátis", async () => {
    const { criarConta } = await import("@/app/acoes/autenticacao");
    const cadastro = new FormData();
    for (const [campo, valor] of Object.entries({
      nome: "Marta Lopes",
      nomeNegocio: "Estúdio Marta",
      email: "marta@teste.com.br",
      telefone: "11987654321",
      documento: "11222333000181",
      senha: "senha-bem-longa",
    })) {
      cadastro.set(campo, valor);
    }
    await expect(criarConta(null, cadastro)).rejects.toMatchObject({ destino: "/painel" });

    const db = await banco();
    const conta = await db.usuario.findUnique({
      where: { email: "marta@teste.com.br" },
      include: { assinatura: true },
    });
    expect(conta?.assinatura?.status).toBe("demonstracao");
    // Já existe gente antes (as contas dos testes acima): não vira administração.
    expect(conta?.papel).toBe("dona");
  });
});
