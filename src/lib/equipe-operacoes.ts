/**
 * Tudo o que a Equipe grava e lê no banco, num lugar só.
 *
 * As ações da tela chamam estas funções com o Prisma do servidor; os testes
 * chamam as mesmas funções com o banco de teste. Assim o que o teste confere é
 * exatamente o que a tela faz, e não uma cópia que pode se distanciar.
 *
 * Toda consulta filtra pelo estúdio (`usuarioId`). Um id vindo do formulário
 * nunca é usado sozinho: antes de ler ou mudar, confere-se que ele é do estúdio
 * da sessão. Sem esse filtro, um id trocado no navegador abriria a equipe de
 * outra pessoa.
 */
import type { PrismaClient } from "@/generated/prisma";
import {
  apenasDigitos,
  deDataLocal,
  deDataPura,
  documentoValido,
  inicioDaCompetencia,
  paraCentavos,
  paraDataPura,
} from "@/lib/formato";
import {
  NOME_DE_QUEM_SAIU,
  TROCA_DE_VINCULO_RECUSADA,
  ativoNoMes,
  ausenciaPermitida,
  categoriaDoPagamento,
  combinadoDoVinculo,
  competenciaValida,
  descricaoDoLancamento,
  ehTipoDeAusencia,
  ehTipoDePagamento,
  ehVinculo,
  limitesDoMes,
  pagamentoPermitido,
  somarMesesACompetencia,
  textoParaPontosBase,
  trocaDeVinculoRecusada,
  type BaseDoMes,
  type TipoDeAusencia,
  type TipoDePagamento,
  type Vinculo,
} from "@/lib/equipe";
import { naturezaDoPagamentoDaEquipe } from "@/lib/custos/regras";
import { conferirMesesAbertos, mesDoDiaPuro, mesDoInstante } from "@/lib/fechamento/trava";

type Banco = PrismaClient;
type Ler = (campo: string) => string;

export type Falha = { erro: string };

// ---------------------------------------------------------------------------
// Leitura dos formulários
// ---------------------------------------------------------------------------

export type EntradaDoColaborador = {
  id: string | null;
  nome: string;
  cargo: string | null;
  vinculo: Vinculo;
  inicio: string;
  fim: string | null;
  salarioCentavos: number;
  comissaoPontosBase: number;
  porAtendimentoCentavos: number;
  documento: string | null;
  pixChave: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
};

/** Vazio vale zero; texto que não é dinheiro vale null, para a tela avisar. */
function dinheiroOpcional(texto: string) {
  if (!texto) return 0;
  return paraCentavos(texto);
}

function diaValido(texto: string) {
  return deDataPura(texto) ? texto : null;
}

export function lerColaborador(ler: Ler): EntradaDoColaborador | Falha {
  const nome = ler("nome").replace(/\s+/g, " ");
  const cargo = ler("cargo");
  const vinculo = ler("vinculo");
  const inicio = diaValido(ler("inicio"));
  const fimTexto = ler("fim");
  const fim = fimTexto ? diaValido(fimTexto) : null;
  const salario = dinheiroOpcional(ler("salario"));
  const porAtendimento = dinheiroOpcional(ler("porAtendimento"));
  const pontosBase = textoParaPontosBase(ler("percentual"));
  const documento = apenasDigitos(ler("documento"));
  const telefone = apenasDigitos(ler("telefone"));
  const email = ler("email").toLowerCase();
  const pixChave = ler("pixChave");
  const observacoes = ler("observacoes");

  if (nome.length < 2) return { erro: "Escreva o nome da pessoa." };
  if (nome.length > 120) return { erro: "O nome ficou comprido demais. Use até 120 letras." };
  if (cargo.length > 80) return { erro: "Use até 80 letras no cargo." };
  if (!ehVinculo(vinculo)) return { erro: "Escolha o vínculo." };
  if (!inicio) return { erro: "Escolha o dia em que a pessoa começou." };
  if (fimTexto && !fim) return { erro: "Não consegui entender o último dia. Pode conferir?" };
  if (fim && fim < inicio) return { erro: "O último dia não pode ser antes do início." };
  if (salario === null || porAtendimento === null) {
    return { erro: "Confira os valores: use só números, como 1.900,00." };
  }
  if (pontosBase === null) {
    return { erro: "Digite um percentual de 0 a 100, com até duas casas, como 40 ou 40,5." };
  }
  if (documento && !documentoValido(documento)) {
    return { erro: "Esse CPF ou CNPJ não confere. Pode olhar de novo?" };
  }
  if (telefone && (telefone.length < 10 || telefone.length > 11)) {
    return { erro: "Digite o telefone com DDD, como (65) 99251-3501." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "Esse e-mail parece incompleto. Pode conferir?" };
  }
  if (pixChave.length > 140) return { erro: "A chave Pix ficou comprida demais." };
  if (observacoes.length > 1000) return { erro: "Use até 1.000 letras nas observações." };

  return {
    id: ler("id") || null,
    nome,
    cargo: cargo || null,
    vinculo,
    inicio,
    fim,
    salarioCentavos: salario,
    comissaoPontosBase: pontosBase,
    porAtendimentoCentavos: porAtendimento,
    documento: documento || null,
    pixChave: pixChave || null,
    telefone: telefone || null,
    email: email || null,
    observacoes: observacoes || null,
  };
}

export type EntradaDaAusencia = {
  colaboradorId: string;
  tipo: TipoDeAusencia;
  inicio: string;
  fim: string;
};

export function lerAusencia(ler: Ler): EntradaDaAusencia | Falha {
  const colaboradorId = ler("colaboradorId");
  const tipo = ler("tipo");
  const inicio = diaValido(ler("inicio"));
  const fim = diaValido(ler("fim") || ler("inicio"));

  if (!colaboradorId) return { erro: "Escolha a pessoa." };
  if (!ehTipoDeAusencia(tipo)) return { erro: "Escolha o tipo da ausência." };
  if (!inicio) return { erro: "Escolha o primeiro dia." };
  if (!fim) return { erro: "Não consegui entender o último dia. Pode conferir?" };
  if (fim < inicio) return { erro: "O último dia não pode ser antes do primeiro." };
  return { colaboradorId, tipo, inicio, fim };
}

export type EntradaDoPagamento = {
  colaboradorId: string;
  tipo: TipoDePagamento;
  competencia: string;
  valorCentavos: number;
  pagoEm: string;
};

export function lerPagamento(ler: Ler): EntradaDoPagamento | Falha {
  const colaboradorId = ler("colaboradorId");
  const tipo = ler("tipo");
  const competencia = ler("competencia");
  const valorCentavos = paraCentavos(ler("valor"));
  const pagoEm = diaValido(ler("pagoEm"));

  if (!colaboradorId) return { erro: "Escolha a pessoa." };
  if (!ehTipoDePagamento(tipo)) return { erro: "Escolha o tipo do pagamento." };
  if (!competenciaValida(competencia)) return { erro: "Escolha o mês de referência." };
  if (!valorCentavos || valorCentavos <= 0) {
    return { erro: "Informe um valor maior que zero, como 1.900,00." };
  }
  if (!pagoEm) return { erro: "Escolha o dia do pagamento." };
  return { colaboradorId, tipo, competencia, valorCentavos, pagoEm };
}

// ---------------------------------------------------------------------------
// Colaborador
// ---------------------------------------------------------------------------

export async function salvarColaborador(
  db: Banco,
  usuarioId: string,
  entrada: EntradaDoColaborador,
): Promise<Falha | { id: string; novo: boolean }> {
  const combinado = combinadoDoVinculo(entrada.vinculo, entrada);
  const registro = {
    nome: entrada.nome,
    cargo: entrada.cargo,
    vinculo: entrada.vinculo,
    inicio: deDataPura(entrada.inicio)!,
    fim: entrada.fim ? deDataPura(entrada.fim) : null,
    ...combinado,
    documento: entrada.documento,
    pixChave: entrada.pixChave,
    telefone: entrada.telefone,
    email: entrada.email,
    observacoes: entrada.observacoes,
  };

  if (!entrada.id) {
    const criado = await db.colaborador.create({
      data: { usuarioId, ...registro },
      select: { id: true },
    });
    return { id: criado.id, novo: true };
  }

  const atual = await db.colaborador.findFirst({
    where: { id: entrada.id, usuarioId },
    select: {
      id: true,
      vinculo: true,
      anonimizadoEm: true,
      ausencias: { select: { tipo: true, inicio: true } },
      pagamentos: { select: { tipo: true, competencia: true } },
    },
  });
  if (!atual) return { erro: "Não encontramos essa pessoa na sua equipe." };
  if (atual.anonimizadoEm) return { erro: "Esse cadastro foi removido e não pode mais ser editado." };

  const de = ehVinculo(atual.vinculo) ? atual.vinculo : entrada.vinculo;
  if (
    trocaDeVinculoRecusada(de, entrada.vinculo, {
      ausencias: atual.ausencias.map((item) => item.tipo),
      pagamentos: atual.pagamentos.map((item) => item.tipo),
    })
  ) {
    return { erro: TROCA_DE_VINCULO_RECUSADA };
  }

  const mudados = await db.colaborador.updateMany({
    where: { id: atual.id, usuarioId, anonimizadoEm: null },
    data: registro,
  });
  if (mudados.count === 0) return { erro: "Não encontramos essa pessoa na sua equipe." };
  return { id: atual.id, novo: false };
}

export async function desligarColaborador(
  db: Banco,
  usuarioId: string,
  id: string,
  fimTexto: string,
): Promise<Falha | { certo: true }> {
  const fim = deDataPura(fimTexto);
  if (!fim) return { erro: "Escolha o último dia de trabalho." };

  const atual = await db.colaborador.findFirst({
    where: { id, usuarioId, anonimizadoEm: null },
    select: { inicio: true },
  });
  if (!atual) return { erro: "Não encontramos essa pessoa na sua equipe." };
  if (fim.getTime() < atual.inicio.getTime()) {
    return { erro: "O último dia não pode ser antes do início do trabalho." };
  }

  await db.colaborador.updateMany({
    where: { id, usuarioId, anonimizadoEm: null },
    data: { fim },
  });
  return { certo: true };
}

/**
 * Remover alguém da equipe.
 *
 * Sem pagamento registrado, o cadastro some por completo, com as ausências.
 * Com pagamento, apagar levaria junto o histórico de dinheiro que o contador
 * precisa guardar. Então a pessoa é anonimizada: o nome vira "Ex-colaborador"
 * (também na descrição dos lançamentos), somem documento, Pix, contato,
 * observações e ausências (atestado é dado de saúde), e os valores ficam.
 *
 * Os horários da agenda que ela atendeu continuam lá, sem o nome dela.
 */
export async function removerColaborador(
  db: Banco,
  usuarioId: string,
  id: string,
  hoje: string,
): Promise<Falha | { resultado: "removido" | "anonimizado" }> {
  return db.$transaction(async (tx) => {
    const atual = await tx.colaborador.findFirst({
      where: { id, usuarioId },
      select: {
        id: true,
        inicio: true,
        fim: true,
        anonimizadoEm: true,
        pagamentos: { select: { tipo: true, lancamentoId: true } },
      },
    });
    if (!atual) return { erro: "Não encontramos essa pessoa na sua equipe." };
    if (atual.anonimizadoEm) return { resultado: "anonimizado" as const };

    if (atual.pagamentos.length === 0) {
      // Ausências vão em cascata; os horários da agenda ficam, soltos.
      await tx.colaborador.deleteMany({ where: { id: atual.id, usuarioId } });
      return { resultado: "removido" as const };
    }

    const hojeData = deDataPura(hoje)!;
    const fim =
      atual.fim ?? (hojeData.getTime() < atual.inicio.getTime() ? atual.inicio : hojeData);

    await tx.colaborador.updateMany({
      where: { id: atual.id, usuarioId },
      data: {
        nome: NOME_DE_QUEM_SAIU,
        cargo: null,
        documento: null,
        pixChave: null,
        telefone: null,
        email: null,
        observacoes: null,
        anonimizadoEm: new Date(),
        fim,
      },
    });
    await tx.ausenciaDoColaborador.deleteMany({ where: { colaboradorId: atual.id, usuarioId } });
    await tx.agendamento.updateMany({
      where: { colaboradorId: atual.id, usuarioId },
      data: { colaboradorId: null },
    });
    for (const pagamento of atual.pagamentos) {
      if (!ehTipoDePagamento(pagamento.tipo)) continue;
      await tx.lancamento.updateMany({
        where: { id: pagamento.lancamentoId, usuarioId },
        data: { descricao: descricaoDoLancamento(pagamento.tipo, null) },
      });
    }
    return { resultado: "anonimizado" as const };
  });
}

// ---------------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------------

export async function registrarAusencia(
  db: Banco,
  usuarioId: string,
  entrada: EntradaDaAusencia,
): Promise<Falha | { id: string }> {
  const colaborador = await db.colaborador.findFirst({
    where: { id: entrada.colaboradorId, usuarioId, anonimizadoEm: null },
    select: { id: true, vinculo: true },
  });
  if (!colaborador) return { erro: "Não encontramos essa pessoa na sua equipe." };
  if (!ehVinculo(colaborador.vinculo) || !ausenciaPermitida(colaborador.vinculo, entrada.tipo)) {
    return { erro: "Esse tipo de ausência não combina com o vínculo dessa pessoa." };
  }

  const criada = await db.ausenciaDoColaborador.create({
    data: {
      usuarioId,
      colaboradorId: colaborador.id,
      tipo: entrada.tipo,
      inicio: deDataPura(entrada.inicio)!,
      fim: deDataPura(entrada.fim)!,
    },
    select: { id: true },
  });
  return criada;
}

export async function excluirAusencia(db: Banco, usuarioId: string, id: string) {
  const apagadas = await db.ausenciaDoColaborador.deleteMany({ where: { id, usuarioId } });
  return apagadas.count > 0;
}

/** A pessoa tem ausência registrada que cobre esse dia? Usado pela agenda. */
export async function ausenciaNoDia(db: Banco, usuarioId: string, colaboradorId: string, dia: string) {
  const data = deDataPura(dia);
  if (!data) return null;
  return db.ausenciaDoColaborador.findFirst({
    where: { usuarioId, colaboradorId, inicio: { lte: data }, fim: { gte: data } },
    select: { tipo: true, inicio: true, fim: true },
  });
}

// ---------------------------------------------------------------------------
// Pagamentos: nascem e morrem junto com a saída nas Finanças
// ---------------------------------------------------------------------------

export async function registrarPagamento(
  db: Banco,
  usuarioId: string,
  entrada: EntradaDoPagamento,
): Promise<Falha | { id: string; lancamentoId: string }> {
  return db.$transaction(async (tx) => {
    // O dinheiro sai no dia do pagamento: é esse mês que não pode estar fechado.
    const fechado = await conferirMesesAbertos(tx, usuarioId, [
      mesDoDiaPuro(deDataPura(entrada.pagoEm)!),
    ]);
    if (fechado) return { erro: fechado.erro };

    const colaborador = await tx.colaborador.findFirst({
      where: { id: entrada.colaboradorId, usuarioId, anonimizadoEm: null },
      select: { id: true, nome: true, vinculo: true },
    });
    if (!colaborador) return { erro: "Não encontramos essa pessoa na sua equipe." };
    if (!ehVinculo(colaborador.vinculo) || !pagamentoPermitido(colaborador.vinculo, entrada.tipo)) {
      return { erro: "Esse tipo de pagamento não combina com o vínculo dessa pessoa." };
    }

    /*
      A saída nas Finanças leva a data no fuso do estúdio, como os lançamentos
      digitados à mão; o pagamento guarda o dia puro. A descrição leva o tipo e
      o nome abreviado, nunca CPF.
    */
    // Comissão e cota-parte já nascem variáveis; salário, fixo. Ver Custos.
    const natureza = naturezaDoPagamentoDaEquipe(entrada.tipo);
    const lancamento = await tx.lancamento.create({
      data: {
        usuarioId,
        tipo: "saida",
        descricao: descricaoDoLancamento(entrada.tipo, colaborador.nome),
        categoria: categoriaDoPagamento(entrada.tipo),
        valorCentavos: entrada.valorCentavos,
        data: deDataLocal(entrada.pagoEm)!,
        ...(natureza
          ? { natureza: natureza.natureza, naturezaOrigem: "regra", naturezaMotivo: natureza.motivo }
          : {}),
      },
      select: { id: true },
    });

    const pagamento = await tx.pagamentoDeColaborador.create({
      data: {
        usuarioId,
        colaboradorId: colaborador.id,
        tipo: entrada.tipo,
        competencia: entrada.competencia,
        valorCentavos: entrada.valorCentavos,
        pagoEm: deDataPura(entrada.pagoEm)!,
        lancamentoId: lancamento.id,
      },
      select: { id: true },
    });

    return { id: pagamento.id, lancamentoId: lancamento.id };
  });
}

/**
 * Apaga o pagamento e a saída que ele criou, juntos. Devolve false se não for
 * do estúdio, e `{ erro }` se o mês da saída estiver fechado.
 */
export async function excluirPagamento(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<boolean | (Falha & { competencia: string })> {
  return db.$transaction(async (tx) => {
    const pagamento = await tx.pagamentoDeColaborador.findFirst({
      where: { id, usuarioId },
      select: {
        id: true,
        lancamentoId: true,
        competencia: true,
        pagoEm: true,
        lancamento: { select: { data: true } },
      },
    });
    if (!pagamento) return false;

    const fechado = await conferirMesesAbertos(tx, usuarioId, [
      mesDoDiaPuro(pagamento.pagoEm),
      mesDoInstante(pagamento.lancamento.data),
    ]);
    if (fechado) return { erro: fechado.erro, competencia: pagamento.competencia };

    await tx.pagamentoDeColaborador.deleteMany({ where: { id: pagamento.id, usuarioId } });
    await tx.lancamento.deleteMany({ where: { id: pagamento.lancamentoId, usuarioId } });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Base da comissão
// ---------------------------------------------------------------------------

/** O primeiro instante do mês e o do mês seguinte, no fuso do estúdio. */
export function instantesDoMes(mes: string) {
  return {
    de: inicioDaCompetencia(mes),
    ate: inicioDaCompetencia(somarMesesACompetencia(mes, 1)),
  };
}

/**
 * A base de cada pessoa no mês: a soma do preço dos atendimentos CONCLUÍDOS
 * por ela, e quantos foram. É a mesma conta que as Finanças fazem para a
 * entrada do mês, então a comissão bate com o que a dona vê lá.
 */
export async function basesDoMes(
  db: Banco,
  usuarioId: string,
  mes: string,
): Promise<Record<string, BaseDoMes>> {
  const { de, ate } = instantesDoMes(mes);
  const atendimentos = await db.agendamento.findMany({
    where: {
      usuarioId,
      status: "concluido",
      colaboradorId: { not: null },
      inicio: { gte: de, lt: ate },
    },
    select: { colaboradorId: true, servico: { select: { precoCentavos: true } } },
  });

  const bases: Record<string, BaseDoMes> = {};
  for (const atendimento of atendimentos) {
    if (!atendimento.colaboradorId) continue;
    const atual = bases[atendimento.colaboradorId] ?? { baseCentavos: 0, atendimentos: 0 };
    bases[atendimento.colaboradorId] = {
      baseCentavos: atual.baseCentavos + atendimento.servico.precoCentavos,
      atendimentos: atual.atendimentos + 1,
    };
  }
  return bases;
}

// ---------------------------------------------------------------------------
// Leituras da tela
// ---------------------------------------------------------------------------

export type ColaboradorDaTela = {
  id: string;
  nome: string;
  cargo: string | null;
  vinculo: Vinculo;
  inicio: string;
  fim: string | null;
  salarioCentavos: number;
  comissaoPontosBase: number;
  porAtendimentoCentavos: number;
  removido: boolean;
};

/** A equipe inteira, inclusive quem saiu, sem os dados pessoais. */
export async function carregarEquipe(db: Banco, usuarioId: string): Promise<ColaboradorDaTela[]> {
  const linhas = await db.colaborador.findMany({
    where: { usuarioId },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      cargo: true,
      vinculo: true,
      inicio: true,
      fim: true,
      salarioCentavos: true,
      comissaoPontosBase: true,
      porAtendimentoCentavos: true,
      anonimizadoEm: true,
    },
  });
  return linhas
    .filter((linha) => ehVinculo(linha.vinculo))
    .map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      cargo: linha.cargo,
      vinculo: linha.vinculo as Vinculo,
      inicio: paraDataPura(linha.inicio),
      fim: linha.fim ? paraDataPura(linha.fim) : null,
      salarioCentavos: linha.salarioCentavos,
      comissaoPontosBase: linha.comissaoPontosBase,
      porAtendimentoCentavos: linha.porAtendimentoCentavos,
      removido: linha.anonimizadoEm !== null,
    }));
}

/** Quem pode ser escolhido em "Quem atende" num dia: ativo nesse dia e não removido. */
export async function equipeQueAtende(db: Banco, usuarioId: string, dia: string) {
  const data = deDataPura(dia);
  if (!data) return [];
  return db.colaborador.findMany({
    where: {
      usuarioId,
      anonimizadoEm: null,
      inicio: { lte: data },
      OR: [{ fim: null }, { fim: { gte: data } }],
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export async function ausenciasDoMes(db: Banco, usuarioId: string, mes: string) {
  const { de, ate } = limitesDoMes(mes);
  const linhas = await db.ausenciaDoColaborador.findMany({
    where: { usuarioId, inicio: { lte: deDataPura(ate)! }, fim: { gte: deDataPura(de)! } },
    orderBy: { inicio: "asc" },
    select: { id: true, colaboradorId: true, tipo: true, inicio: true, fim: true },
  });
  return linhas.map((linha) => ({
    ...linha,
    inicio: paraDataPura(linha.inicio),
    fim: paraDataPura(linha.fim),
  }));
}

export async function pagamentosDoMes(db: Banco, usuarioId: string, mes: string) {
  const linhas = await db.pagamentoDeColaborador.findMany({
    where: { usuarioId, competencia: mes },
    orderBy: [{ pagoEm: "asc" }, { criadoEm: "asc" }],
    select: { id: true, colaboradorId: true, tipo: true, valorCentavos: true, pagoEm: true },
  });
  return linhas.map((linha) => ({ ...linha, pagoEm: paraDataPura(linha.pagoEm) }));
}

/** Quem trabalhou no mês e não foi removido: é quem aparece em Pagamentos. */
export function equipeDoMes(equipe: ColaboradorDaTela[], mes: string) {
  return equipe.filter((pessoa) => !pessoa.removido && ativoNoMes(pessoa, mes));
}
