/**
 * Tudo o que o agendamento online lê e grava no banco, num lugar só.
 *
 * A página pública, a confirmação e a tela de configuração chamam estas
 * funções com o Prisma do servidor; os testes chamam as mesmas funções com o
 * banco de teste. Toda consulta filtra pelo estúdio dono do link.
 *
 * A página pública é aberta a qualquer pessoa. Por isso nada daqui devolve dado
 * de cliente: os atendimentos marcados entram só como "horário ocupado", sem
 * nome, telefone ou serviço, e a resposta da confirmação repete só o que a
 * própria pessoa digitou e o que é do estúdio.
 */
import { Prisma, type PrismaClient } from "@/generated/prisma";
import { avaliarAssinatura } from "@/lib/assinatura";
import { podeUsar } from "@/lib/recursos";
import { ehContaDeExemplo } from "@/lib/demonstracao/conta";
import { travarAgendaDoEstudio } from "@/lib/agenda-trava";
import {
  dataPorExtenso,
  deDataPura,
  deHorarioLocal,
  diaDaSemana,
  hojeNoEstudio,
  hora,
  primeiroNome,
  somarDias,
} from "@/lib/formato";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import {
  diasDaJanela,
  escolherQuemAtende,
  faixasDoDia,
  horariosLivresDasAgendas,
  type Agenda,
} from "./disponibilidade";
import {
  ANTECEDENCIAS,
  DIAS_A_FRENTE_MAXIMO,
  DIAS_A_FRENTE_MINIMO,
  lerFaixas,
  limparLink,
  linkValido,
  telefoneNacional,
  type FaixaDaSemana,
} from "./configuracao";

type Banco = PrismaClient;
/** Serve tanto o Prisma inteiro quanto o de dentro de uma transação. */
type Leitor = Prisma.TransactionClient;

/** Quantas tentativas de confirmar cabem numa hora, antes de a página recusar. */
export const LIMITE_POR_TELEFONE = 5;
export const LIMITE_POR_IP = 10;
const UMA_HORA_MS = 60 * 60 * 1000;
/** As tentativas só servem para a conta da última hora; com um dia, saem. */
const GUARDA_DAS_TENTATIVAS_MS = 24 * UMA_HORA_MS;

/** O maior serviço tem 600 minutos: atendimento que começou até 10h antes ainda pode ocupar. */
const DURACAO_MAXIMA_MS = 600 * 60 * 1000;

export const OBSERVACAO_DO_LINK = "Marcado pelo link";

// ---------------------------------------------------------------------------
// Leitura da página pública
// ---------------------------------------------------------------------------

/** Quem pode atender pelo link. A dona tem id null, como na agenda. */
export type Pessoa = {
  /** O que vai no endereço da página: "dona" ou o id do colaborador. */
  chave: string;
  id: string | null;
  /** Só o primeiro nome: é o que o cliente precisa para escolher. */
  nome: string;
  inicio: string | null;
  fim: string | null;
};

export type ServicoPublico = {
  id: string;
  nome: string;
  descricao: string | null;
  precoCentavos: number;
  duracaoMin: number;
};

export type AgendaPublica = {
  usuarioId: string;
  link: string;
  nomeNegocio: string;
  endereco: string | null;
  telefoneDoEstudio: string | null;
  antecedenciaMin: number;
  diasAFrente: number;
  faixas: FaixaDaSemana[];
  servicos: ServicoPublico[];
  pessoas: Pessoa[];
  /** Mostra o passo "com quem": só com equipe, opção ligada e mais de uma pessoa. */
  escolhe: boolean;
};

export type SituacaoDaPagina =
  | { situacao: "nao_encontrada" }
  | { situacao: "indisponivel" }
  /**
   * O link do estúdio de exemplo: mostra os passos com os dados de exemplo, para
   * quem está na demonstração ver o que a cliente vê, mas nunca aceita horário.
   */
  | { situacao: "demonstracao"; agenda: AgendaPublica }
  | { situacao: "aberta"; agenda: AgendaPublica };

export async function carregarAgendaPublica(
  db: Leitor,
  linkDigitado: string,
  agora = new Date(),
): Promise<SituacaoDaPagina> {
  let link: string;
  try {
    link = limparLink(decodeURIComponent(linkDigitado));
  } catch {
    // "%E0" e companhia: endereço quebrado não é de ninguém.
    return { situacao: "nao_encontrada" };
  }
  if (!linkValido(link)) return { situacao: "nao_encontrada" };

  const config = await db.agendaOnline.findUnique({
    where: { link },
    select: {
      ativa: true,
      antecedenciaMin: true,
      diasAFrente: true,
      escolherQuemAtende: true,
      donaAtende: true,
      usuario: {
        select: {
          id: true,
          papel: true,
          nome: true,
          nomeNegocio: true,
          endereco: true,
          telefone: true,
          assinatura: { select: { status: true, plano: true, validaAte: true } },
        },
      },
    },
  });

  // Link que não existe e link desligado dão a mesma resposta: ninguém de
  // fora precisa saber que aquele endereço já foi de alguém.
  if (!config || !config.ativa) return { situacao: "nao_encontrada" };

  const usuario = config.usuario;
  // O estúdio de exemplo é compartilhado pela demonstração: a página dele
  // mostra os passos, mas nunca recebe horário de ninguém (agendarPeloLink
  // recusa antes de qualquer gravação).
  const exemplo = ehContaDeExemplo(usuario);

  // Conta com assinatura parada não recebe horário novo. O motivo não aparece
  // para o cliente: é assunto entre o estúdio e o Bossa.
  if (!exemplo && !avaliarAssinatura(usuario.assinatura, agora).liberada) {
    return { situacao: "indisponivel" };
  }

  const comEquipe =
    config.escolherQuemAtende && podeUsar({ assinatura: usuario.assinatura }, "equipe", agora);

  const [faixas, servicos, colaboradores] = await Promise.all([
    db.faixaDeAtendimento.findMany({
      where: { usuarioId: usuario.id },
      orderBy: [{ diaDaSemana: "asc" }, { inicioMin: "asc" }],
      select: { diaDaSemana: true, inicioMin: true, fimMin: true },
    }),
    db.servico.findMany({
      where: { usuarioId: usuario.id, ativo: true, agendavelOnline: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, descricao: true, precoCentavos: true, duracaoMin: true },
    }),
    comEquipe
      ? db.colaborador.findMany({
          // Quem já saiu da equipe não aparece como opção.
          where: {
            usuarioId: usuario.id,
            anonimizadoEm: null,
            OR: [{ fim: null }, { fim: { gte: hojeNoEstudio(agora) } }],
          },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true, inicio: true, fim: true },
        })
      : Promise.resolve([]),
  ]);

  const dona: Pessoa = {
    chave: "dona",
    id: null,
    nome: primeiroNome(usuario.nome),
    inicio: null,
    fim: null,
  };
  const daEquipe: Pessoa[] = colaboradores.map((pessoa) => ({
    chave: pessoa.id,
    id: pessoa.id,
    nome: primeiroNome(pessoa.nome),
    inicio: pessoa.inicio.toISOString().slice(0, 10),
    fim: pessoa.fim ? pessoa.fim.toISOString().slice(0, 10) : null,
  }));

  const pessoas = comEquipe
    ? [...(config.donaAtende ? [dona] : []), ...daEquipe]
    : [dona];
  // Equipe ligada mas ninguém para atender: o link volta para a agenda da dona.
  const quemAtende = pessoas.length > 0 ? pessoas : [dona];

  return {
    situacao: exemplo ? "demonstracao" : "aberta",
    agenda: {
      usuarioId: usuario.id,
      link,
      nomeNegocio: usuario.nomeNegocio,
      endereco: usuario.endereco,
      telefoneDoEstudio: usuario.telefone,
      antecedenciaMin: config.antecedenciaMin,
      diasAFrente: config.diasAFrente,
      faixas,
      servicos,
      pessoas: quemAtende,
      escolhe: comEquipe && quemAtende.length > 1,
    },
  };
}

/** O pedido de "com quem" que veio do endereço: alguém, ou tanto faz. */
export type PedidoDePessoa = { qualquer: true } | { id: string | null };

/**
 * Traduz o "quem" do endereço. Sem escolha na página, é sempre a única agenda.
 * Chave que não é de ninguém do estúdio volta null: a página pede de novo.
 */
export function lerPedidoDePessoa(agenda: AgendaPublica, quem: string | undefined): PedidoDePessoa | null {
  if (!agenda.escolhe) return { id: agenda.pessoas[0].id };
  if (!quem) return null;
  if (quem === "qualquer") return { qualquer: true };
  const pessoa = agenda.pessoas.find((item) => item.chave === quem);
  return pessoa ? { id: pessoa.id } : null;
}

export type HorarioOferecido = { inicio: Date; quem: string | null };
export type DiaOferecido = { dia: string; horarios: HorarioOferecido[] };

/**
 * Os horários livres de um serviço, dia a dia, dentro da janela da agenda.
 *
 * Uma consulta só para os atendimentos e outra para as ausências da janela
 * inteira; o resto é a conta pura de disponibilidade.ts. Dos atendimentos sai
 * só o começo, a duração e quem atende: nada de cliente.
 */
export async function horariosOferecidos(
  db: Leitor,
  agenda: AgendaPublica,
  servico: ServicoPublico,
  pedido: PedidoDePessoa,
  agora: Date,
  somenteODia?: string,
): Promise<DiaOferecido[]> {
  const janela = diasDaJanela(agora, agenda.diasAFrente);
  const dias = somenteODia ? janela.filter((dia) => dia === somenteODia) : janela;
  if (dias.length === 0) return [];

  const pessoas =
    "qualquer" in pedido
      ? agenda.pessoas
      : agenda.pessoas.filter((pessoa) => pessoa.id === pedido.id);
  if (pessoas.length === 0) return [];

  const de = deHorarioLocal(`${dias[0]}T00:00`)!;
  const ate = somarDias(deHorarioLocal(`${dias[dias.length - 1]}T00:00`)!, 2);
  const idsDaEquipe = pessoas.map((pessoa) => pessoa.id).filter((id): id is string => id !== null);
  const incluiDona = pessoas.some((pessoa) => pessoa.id === null);
  // Só os atendimentos de quem pode atender; os da dona são os sem colaborador.
  const deQuem: Prisma.AgendamentoWhereInput =
    incluiDona && idsDaEquipe.length > 0
      ? { OR: [{ colaboradorId: null }, { colaboradorId: { in: idsDaEquipe } }] }
      : incluiDona
        ? { colaboradorId: null }
        : { colaboradorId: { in: idsDaEquipe } };

  const [marcados, ausencias] = await Promise.all([
    db.agendamento.findMany({
      where: {
        usuarioId: agenda.usuarioId,
        status: { not: "cancelado" },
        inicio: { gte: new Date(de.getTime() - DURACAO_MAXIMA_MS), lt: ate },
        ...deQuem,
      },
      select: { inicio: true, colaboradorId: true, servico: { select: { duracaoMin: true } } },
    }),
    idsDaEquipe.length > 0
      ? db.ausenciaDoColaborador.findMany({
          where: {
            usuarioId: agenda.usuarioId,
            colaboradorId: { in: idsDaEquipe },
            inicio: { lte: deDataPura(dias[dias.length - 1])! },
            fim: { gte: deDataPura(dias[0])! },
          },
          select: { colaboradorId: true, inicio: true, fim: true },
        })
      : Promise.resolve([]),
  ]);

  const agendas: Agenda[] = pessoas.map((pessoa) => {
    const ausente = ausencias
      .filter((item) => item.colaboradorId === pessoa.id)
      .map((item) => ({
        inicio: item.inicio.toISOString().slice(0, 10),
        fim: item.fim.toISOString().slice(0, 10),
      }));
    return {
      id: pessoa.id,
      ocupados: marcados
        .filter((item) => item.colaboradorId === pessoa.id)
        .map((item) => ({
          inicio: item.inicio,
          fim: new Date(item.inicio.getTime() + item.servico.duracaoMin * 60_000),
        })),
      fora: (dia: string) =>
        (pessoa.inicio !== null && dia < pessoa.inicio) ||
        (pessoa.fim !== null && dia > pessoa.fim) ||
        ausente.some((periodo) => periodo.inicio <= dia && periodo.fim >= dia),
    };
  });

  return dias.map((dia) => {
    const horarios = horariosLivresDasAgendas({
      dia,
      faixas: faixasDoDia(agenda.faixas, dia),
      agendas,
      duracaoMin: servico.duracaoMin,
      agora,
      antecedenciaMin: agenda.antecedenciaMin,
    });
    const oferecidos: HorarioOferecido[] = [];
    for (const horario of horarios) {
      const quem = escolherQuemAtende(horario.livres, pedido);
      if (quem !== undefined) oferecidos.push({ inicio: horario.inicio, quem });
    }
    return { dia, horarios: oferecidos };
  });
}

// ---------------------------------------------------------------------------
// Confirmação pela página pública
// ---------------------------------------------------------------------------

export type PedidoDeAgendamento = {
  link: string;
  servicoId: string;
  quem: string;
  dia: string;
  hora: string;
  nome: string;
  telefone: string;
  /** O campo escondido. Gente não vê e não preenche; robô preenche tudo. */
  isca: string;
};

export type ResumoDoAgendamento = {
  nomeNegocio: string;
  servico: string;
  duracaoMin: number;
  precoCentavos: number;
  quando: string;
  quem: string | null;
  endereco: string | null;
  whatsappDoEstudio: string | null;
  primeiroNome: string;
};

export type RespostaDoAgendamento =
  | { erro: string; ocupado?: boolean }
  | { ok: true; resumo: ResumoDoAgendamento };

const ERRO_GENERICO = "Não deu para confirmar agora. Tente de novo em instantes.";

function limparNome(texto: string) {
  // Sem caractere de controle e sem espaço repetido; o tamanho é o de um nome.
  return texto.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Registra a tentativa e diz se ela passou do limite. Grava antes de contar,
 * para que dois pedidos ao mesmo tempo também se enxerguem na conta.
 */
async function registrarTentativa(
  db: Banco,
  usuarioId: string,
  ipHash: string,
  telefoneHash: string | null,
  agora: Date,
) {
  const tentativa = await db.tentativaDeAgendamento.create({
    data: { usuarioId, ipHash, telefoneHash, criadoEm: agora },
    select: { id: true },
  });
  const desde = new Date(agora.getTime() - UMA_HORA_MS);
  const [peloIp, peloTelefone] = await Promise.all([
    db.tentativaDeAgendamento.count({ where: { ipHash, criadoEm: { gt: desde } } }),
    telefoneHash
      ? db.tentativaDeAgendamento.count({ where: { telefoneHash, criadoEm: { gt: desde } } })
      : Promise.resolve(0),
  ]);
  return {
    id: tentativa.id,
    excedeuIp: peloIp > LIMITE_POR_IP,
    excedeuTelefone: peloTelefone > LIMITE_POR_TELEFONE,
  };
}

/** Apaga as tentativas com mais de um dia. Sem pressa e sem atrapalhar quem marca. */
async function esquecerTentativasAntigas(db: Banco, agora: Date) {
  try {
    await db.tentativaDeAgendamento.deleteMany({
      where: { criadoEm: { lt: new Date(agora.getTime() - GUARDA_DAS_TENTATIVAS_MS) } },
    });
  } catch {
    // Faxina que falha hoje é feita na próxima tentativa.
  }
}

export async function agendarPeloLink(
  db: Banco,
  pedido: PedidoDeAgendamento,
  contexto: { ipHash: string; embaralharTelefone: (telefone: string) => string; agora?: Date },
): Promise<RespostaDoAgendamento> {
  const agora = contexto.agora ?? new Date();

  const pagina = await carregarAgendaPublica(db, pedido.link, agora);
  if (pagina.situacao === "nao_encontrada") {
    return { erro: "Esta página de agendamento não está disponível." };
  }
  if (pagina.situacao === "indisponivel") {
    return { erro: "O agendamento online está indisponível no momento." };
  }
  // Antes de registrar tentativa: no estúdio de exemplo nada é gravado.
  if (pagina.situacao === "demonstracao") {
    return { erro: "Esta é uma página de exemplo do Bossa: nenhum horário é marcado por aqui." };
  }
  const agenda = pagina.agenda;

  const telefone = telefoneNacional(pedido.telefone);
  const tentativa = await registrarTentativa(
    db,
    agenda.usuarioId,
    contexto.ipHash,
    telefone ? contexto.embaralharTelefone(telefone) : null,
    agora,
  );
  await esquecerTentativasAntigas(db, agora);

  // A isca preenchida é robô. A resposta não conta isso a ele.
  if (pedido.isca.trim() !== "") return { erro: ERRO_GENERICO };
  if (tentativa.excedeuIp) {
    return { erro: "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo." };
  }
  if (tentativa.excedeuTelefone) {
    return {
      erro: "Esse WhatsApp já tentou marcar várias vezes na última hora. Se precisar, fale direto com o estúdio.",
    };
  }

  const nome = limparNome(pedido.nome);
  if (nome.replace(/[^\p{L}]/gu, "").length < 2) {
    return { erro: "Escreva o seu nome, por favor." };
  }
  if (!telefone) {
    return { erro: "Confira o WhatsApp: precisa ter DDD e número, como (11) 98765-4321." };
  }

  const servico = agenda.servicos.find((item) => item.id === pedido.servicoId);
  if (!servico) return { erro: "Esse serviço não está disponível pelo link. Escolha outro." };

  const pessoa = lerPedidoDePessoa(agenda, pedido.quem || undefined);
  if (!pessoa) return { erro: "Escolha quem vai atender você." };

  const inicio = /^\d{2}:\d{2}$/.test(pedido.hora) && deDataPura(pedido.dia)
    ? deHorarioLocal(`${pedido.dia}T${pedido.hora}`)
    : null;
  if (!inicio) return { erro: "Escolha o dia e o horário de novo, por favor." };

  const gravado = await db.$transaction(
    async (tx) => {
      await travarAgendaDoEstudio(tx, agenda.usuarioId);

      // A conta é refeita aqui dentro, já com a trava: a lista que a página
      // mostrou pode ter ficado velha enquanto a pessoa digitava o nome.
      const [doDia] = await horariosOferecidos(tx, agenda, servico, pessoa, agora, pedido.dia);
      const livre = doDia?.horarios.find((item) => item.inicio.getTime() === inicio.getTime());
      if (!livre) return null;

      const cliente = await clientePeloTelefone(tx, agenda.usuarioId, telefone, nome);

      await tx.agendamento.create({
        data: {
          usuarioId: agenda.usuarioId,
          clienteId: cliente.id,
          servicoId: servico.id,
          inicio,
          colaboradorId: livre.quem,
          precoCentavos: servico.precoCentavos,
          origem: "link",
          observacoes: cliente.nomeDiferente
            ? `${OBSERVACAO_DO_LINK} · nome informado: ${nome}`
            : OBSERVACAO_DO_LINK,
        },
        select: { id: true },
      });

      await tx.tentativaDeAgendamento.update({
        where: { id: tentativa.id },
        data: { sucesso: true },
      });

      return { quem: livre.quem };
    },
    { maxWait: 10_000, timeout: 15_000 },
  ).catch((erro: unknown) => {
    // Quem marca não precisa ver o erro técnico; a dona não perde nada, porque
    // nada foi gravado (a transação volta inteira).
    console.error("Falha ao confirmar horário pelo link", erro);
    return undefined;
  });

  if (gravado === undefined) return { erro: ERRO_GENERICO };
  if (gravado === null) {
    return { erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor.", ocupado: true };
  }

  const quem = agenda.escolhe
    ? (agenda.pessoas.find((item) => item.id === gravado.quem)?.nome ?? null)
    : null;
  const whatsapp = telefoneParaWhatsApp(agenda.telefoneDoEstudio);

  return {
    ok: true,
    resumo: {
      nomeNegocio: agenda.nomeNegocio,
      servico: servico.nome,
      duracaoMin: servico.duracaoMin,
      precoCentavos: servico.precoCentavos,
      quando: `${diaDaSemana(inicio)}, ${dataPorExtenso(inicio)} às ${hora(inicio)}`,
      quem,
      endereco: agenda.endereco,
      whatsappDoEstudio: whatsapp.certo
        ? linkDoWhatsApp(
            whatsapp.paraWhatsApp,
            `Olá! Marquei ${servico.nome} pelo link para ${dataPorExtenso(inicio)} às ${hora(inicio)}.`,
          )
        : null,
      primeiroNome: primeiroNome(nome),
    },
  };
}

/**
 * O cliente do estúdio com esse WhatsApp, ou um novo.
 *
 * A ficha guarda o telefone do jeito que a dona digitou, "(66) 99251-3501",
 * por isso a comparação é feita só com os dígitos, com ou sem o 55 na frente.
 * Cliente que já existe não tem a ficha mudada por quem marcou pelo link: o
 * nome digitado lá fora pode estar errado, ou ser de outra pessoa.
 */
async function clientePeloTelefone(
  tx: Leitor,
  usuarioId: string,
  nacional: string,
  nome: string,
): Promise<{ id: string; nomeDiferente: boolean }> {
  const achados = await tx.$queryRaw<{ id: string; nome: string }[]>`
    SELECT "id", "nome" FROM "Cliente"
    WHERE "usuarioId" = ${usuarioId}
      AND regexp_replace("telefone", '\\D', '', 'g') IN (${nacional}, ${`55${nacional}`})
    ORDER BY "criadoEm" ASC
    LIMIT 1
  `;
  if (achados.length > 0) {
    return {
      id: achados[0].id,
      // Nome diferente vai para a observação do horário, para a dona conferir.
      nomeDiferente: achados[0].nome.trim().toLowerCase() !== nome.toLowerCase(),
    };
  }

  const novo = await tx.cliente.create({
    data: { usuarioId, nome, telefone: nacional },
    select: { id: true },
  });
  return { id: novo.id, nomeDiferente: false };
}

// ---------------------------------------------------------------------------
// Painel: novidades no Início
// ---------------------------------------------------------------------------

/** Horários que chegaram pelo link e a dona ainda não viu, do mais novo ao mais antigo. */
export async function novosPeloLink(db: Leitor, usuarioId: string, agora: Date) {
  return db.agendamento.findMany({
    where: {
      usuarioId,
      origem: "link",
      vistoEm: null,
      status: { not: "cancelado" },
      // Horário que já passou não é mais novidade.
      inicio: { gte: new Date(agora.getTime() - 12 * UMA_HORA_MS) },
    },
    orderBy: { criadoEm: "desc" },
    take: 20,
    select: {
      id: true,
      inicio: true,
      cliente: { select: { nome: true } },
      servico: { select: { nome: true } },
      colaborador: { select: { nome: true } },
    },
  });
}

export async function marcarNovosComoVistos(db: Leitor, usuarioId: string, agora = new Date()) {
  const mudados = await db.agendamento.updateMany({
    where: { usuarioId, origem: "link", vistoEm: null },
    data: { vistoEm: agora },
  });
  return mudados.count;
}

// ---------------------------------------------------------------------------
// Painel: configuração
// ---------------------------------------------------------------------------

export type EntradaDaConfiguracao = {
  link: string;
  antecedenciaMin: number;
  diasAFrente: number;
  faixas: FaixaDaSemana[];
  servicosIds: string[];
  escolherQuemAtende: boolean;
  donaAtende: boolean;
};

/** Lê o formulário da configuração. Tudo o que vem do navegador é conferido aqui. */
export function lerConfiguracao(dados: FormData): EntradaDaConfiguracao | { erro: string } {
  const texto = (campo: string) => {
    const valor = dados.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };

  const link = limparLink(texto("link"));
  if (!linkValido(link)) {
    return {
      erro: "O endereço precisa ter de 3 a 40 caracteres: letras sem acento, números e hífen no meio, como estudio-bela-pele.",
    };
  }

  const antecedenciaMin = Number(texto("antecedenciaMin"));
  if (!ANTECEDENCIAS.some((opcao) => opcao.valor === antecedenciaMin)) {
    return { erro: "Escolha a antecedência mínima da lista." };
  }

  const diasAFrente = Number(texto("diasAFrente"));
  if (
    !Number.isInteger(diasAFrente) ||
    diasAFrente < DIAS_A_FRENTE_MINIMO ||
    diasAFrente > DIAS_A_FRENTE_MAXIMO
  ) {
    return {
      erro: `Os dias à frente precisam ficar entre ${DIAS_A_FRENTE_MINIMO} e ${DIAS_A_FRENTE_MAXIMO}.`,
    };
  }

  const faixas = lerFaixas(
    dados.getAll("faixa").filter((valor): valor is string => typeof valor === "string"),
  );
  if ("erro" in faixas) return faixas;

  const servicosIds = [
    ...new Set(dados.getAll("servico").filter((valor): valor is string => typeof valor === "string")),
  ];

  return {
    link,
    antecedenciaMin,
    diasAFrente,
    faixas: faixas.faixas,
    servicosIds,
    escolherQuemAtende: dados.get("escolherQuemAtende") === "on",
    donaAtende: dados.get("donaAtende") === "on",
  };
}

function linkRepetido(erro: unknown) {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

const LINK_EM_USO = "Esse endereço já está em uso por outro estúdio. Tente uma variação, como acrescentar a cidade.";

export async function salvarConfiguracao(
  db: Banco,
  usuarioId: string,
  entrada: EntradaDaConfiguracao,
): Promise<{ erro: string } | { ok: true }> {
  const dono = await db.agendaOnline.findUnique({ where: { link: entrada.link }, select: { usuarioId: true } });
  if (dono && dono.usuarioId !== usuarioId) return { erro: LINK_EM_USO };

  const atual = await db.agendaOnline.findUnique({ where: { usuarioId }, select: { ativa: true } });
  if (atual?.ativa && entrada.faixas.length === 0) {
    return { erro: "Com a página no ar, deixe pelo menos um horário de atendimento, ou desligue a página antes." };
  }

  try {
    await db.$transaction(async (tx) => {
      const valores = {
        link: entrada.link,
        antecedenciaMin: entrada.antecedenciaMin,
        diasAFrente: entrada.diasAFrente,
        escolherQuemAtende: entrada.escolherQuemAtende,
        donaAtende: entrada.donaAtende,
      };
      await tx.agendaOnline.upsert({
        where: { usuarioId },
        create: { usuarioId, ...valores },
        update: valores,
      });

      await tx.faixaDeAtendimento.deleteMany({ where: { usuarioId } });
      if (entrada.faixas.length > 0) {
        await tx.faixaDeAtendimento.createMany({
          data: entrada.faixas.map((faixa) => ({ usuarioId, ...faixa })),
        });
      }

      // Só os serviços ativos aparecem no formulário; os guardados ficam como estão.
      await tx.servico.updateMany({
        where: { usuarioId, ativo: true, id: { in: entrada.servicosIds } },
        data: { agendavelOnline: true },
      });
      await tx.servico.updateMany({
        where: { usuarioId, ativo: true, id: { notIn: entrada.servicosIds } },
        data: { agendavelOnline: false },
      });
    });
  } catch (erro) {
    if (linkRepetido(erro)) return { erro: LINK_EM_USO };
    throw erro;
  }

  return { ok: true };
}

/** Liga ou desliga a página. Ligar exige horário e serviço, senão o link abre vazio. */
export async function ligarAgendaOnline(
  db: Banco,
  usuarioId: string,
  ligar: boolean,
): Promise<{ erro: string } | { ok: true }> {
  const config = await db.agendaOnline.findUnique({ where: { usuarioId }, select: { id: true } });
  if (!config) return { erro: "Salve a configuração antes de colocar a página no ar." };

  if (ligar) {
    const [faixas, servicos] = await Promise.all([
      db.faixaDeAtendimento.count({ where: { usuarioId } }),
      db.servico.count({ where: { usuarioId, ativo: true, agendavelOnline: true } }),
    ]);
    if (faixas === 0) return { erro: "Antes de ligar, cadastre pelo menos um horário de atendimento." };
    if (servicos === 0) return { erro: "Antes de ligar, deixe pelo menos um serviço aparecer no link." };
  }

  await db.agendaOnline.updateMany({ where: { usuarioId }, data: { ativa: ligar } });
  return { ok: true };
}
