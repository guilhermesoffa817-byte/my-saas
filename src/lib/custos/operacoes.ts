/**
 * Tudo o que a tela de Custos lê e grava no banco, num lugar só.
 *
 * As ações da tela chamam estas funções com o Prisma do servidor; os testes
 * chamam as mesmas funções com o banco de teste. Toda consulta filtra pelo
 * estúdio (`usuarioId`): um id de lançamento vindo do formulário nunca é usado
 * sozinho.
 */
import type { PrismaClient } from "@/generated/prisma";
import { competenciaAtual, inicioDaCompetencia, paraDataLocal } from "@/lib/formato";
import {
  deslocarMes,
  ehNatureza,
  ehOrigem,
  type DespesaParaCusto,
  type Natureza,
  type ReceitaParaCusto,
} from "./calculo";
import { motivoParaGravar } from "./regras";

type Banco = PrismaClient;

/** O primeiro instante do mês "AAAA-MM", à meia-noite de São Paulo. */
export function inicioDoMesTexto(mes: string) {
  return inicioDaCompetencia(mes);
}

/** Os seis meses que terminam em `mes`: de onde a tendência e a comparação saem. */
export function janelaDeSeisMeses(mes: string) {
  return { de: inicioDoMesTexto(deslocarMes(mes, -5)), ate: inicioDoMesTexto(deslocarMes(mes, 1)) };
}

/**
 * Carrega seis meses de movimento: as saídas viram despesas e a receita é a
 * mesma da página Finanças (atendimentos concluídos pelo preço do serviço, mais
 * as entradas lançadas à mão), contada mês a mês no fuso do estúdio.
 */
export async function carregarMovimento(
  db: Banco,
  usuarioId: string,
  mes: string,
): Promise<{ despesas: DespesaParaCusto[]; receitas: ReceitaParaCusto[] }> {
  const { de, ate } = janelaDeSeisMeses(mes);

  const [atendimentos, lancamentos] = await Promise.all([
    db.agendamento.findMany({
      where: { usuarioId, status: "concluido", inicio: { gte: de, lt: ate } },
      select: { inicio: true, servico: { select: { precoCentavos: true } } },
    }),
    db.lancamento.findMany({
      where: { usuarioId, data: { gte: de, lt: ate } },
      orderBy: { data: "asc" },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        categoria: true,
        valorCentavos: true,
        data: true,
        natureza: true,
        naturezaOrigem: true,
        naturezaMotivo: true,
        pagamentoDeColaborador: { select: { id: true } },
      },
    }),
  ]);

  const receitas: ReceitaParaCusto[] = atendimentos.map((atendimento) => ({
    mes: competenciaAtual(atendimento.inicio),
    valorCentavos: atendimento.servico.precoCentavos,
    atendimento: true,
  }));

  const despesas: DespesaParaCusto[] = [];
  for (const lancamento of lancamentos) {
    const mesDoLancamento = competenciaAtual(lancamento.data);
    if (lancamento.tipo === "entrada") {
      receitas.push({ mes: mesDoLancamento, valorCentavos: lancamento.valorCentavos, atendimento: false });
      continue;
    }
    const natureza = ehNatureza(lancamento.natureza) ? lancamento.natureza : null;
    despesas.push({
      id: lancamento.id,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      valorCentavos: lancamento.valorCentavos,
      mes: mesDoLancamento,
      dia: paraDataLocal(lancamento.data),
      natureza,
      origem: natureza && ehOrigem(lancamento.naturezaOrigem) ? lancamento.naturezaOrigem : null,
      motivo: natureza ? lancamento.naturezaMotivo : null,
      daEquipe: Boolean(lancamento.pagamentoDeColaborador),
    });
  }

  return { despesas, receitas };
}

/**
 * A dona escolhe a natureza de uma despesa (origem "voce") ou apaga a
 * classificação. Só mexe em saída do próprio estúdio.
 */
export async function definirNatureza(
  db: Banco,
  usuarioId: string,
  lancamentoId: string,
  escolha: Natureza | "nenhuma",
): Promise<boolean> {
  const mudou = await db.lancamento.updateMany({
    where: { id: lancamentoId, usuarioId, tipo: "saida" },
    data:
      escolha === "nenhuma"
        ? { natureza: null, naturezaOrigem: null, naturezaMotivo: null }
        : { natureza: escolha, naturezaOrigem: "voce", naturezaMotivo: null },
  });
  return mudou.count > 0;
}

/**
 * Grava classificações de regra ou de IA. Só preenche quem ainda está sem
 * natureza, na própria consulta: se a dona classificou no meio do caminho,
 * a escolha dela fica. Devolve quantas foram gravadas.
 */
export async function gravarClassificacoes(
  db: Banco,
  usuarioId: string,
  lista: { id: string; natureza: Natureza; motivo: string }[],
  origem: "regra" | "ia",
): Promise<number> {
  if (lista.length === 0) return 0;
  const resultados = await db.$transaction(
    lista.map((item) =>
      db.lancamento.updateMany({
        where: { id: item.id, usuarioId, tipo: "saida", natureza: null },
        data: {
          natureza: item.natureza,
          naturezaOrigem: origem,
          naturezaMotivo: motivoParaGravar(item.motivo),
        },
      }),
    ),
  );
  return resultados.reduce((soma, resultado) => soma + resultado.count, 0);
}

/**
 * Nomes de pessoas que podem aparecer numa descrição de despesa: a dona, a
 * equipe e os clientes. Saem do texto antes de ele ir para a IA.
 */
export async function nomesParaOcultar(db: Banco, usuarioId: string): Promise<string[]> {
  const [dona, equipe, clientes] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }),
    db.colaborador.findMany({ where: { usuarioId, anonimizadoEm: null }, select: { nome: true } }),
    db.cliente.findMany({ where: { usuarioId }, select: { nome: true } }),
  ]);
  return [dona?.nome ?? "", ...equipe.map((p) => p.nome), ...clientes.map((c) => c.nome)].filter(Boolean);
}

/** O mês da tela: o que veio no endereço, se for válido e não estiver no futuro. */
export function mesDaTela(pedido: string | undefined, agora = new Date()) {
  const atual = competenciaAtual(agora);
  if (!pedido || !/^\d{4}-(0[1-9]|1[0-2])$/.test(pedido)) return atual;
  return pedido > atual ? atual : pedido;
}
