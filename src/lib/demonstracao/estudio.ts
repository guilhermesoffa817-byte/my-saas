/**
 * Cria e mantém atualizado o estúdio de exemplo da demonstração.
 *
 * Os dados são relativos a "hoje". Por isso, quando ficam velhos (mais de 12
 * horas, ou de outro dia em São Paulo), a próxima visita refaz tudo: apaga a
 * conta de exemplo (o banco leva junto, em cascata, tudo o que é dela) e grava
 * de novo, numa transação só. Quem estiver olhando no mesmo instante continua
 * vendo os dados antigos até a transação terminar, nunca uma conta pela metade.
 *
 * Dois visitantes chegando juntos não refazem duas vezes: a trava do Postgres
 * (pg_advisory_xact_lock) põe o segundo na fila, e ele, ao entrar, vê que o
 * primeiro já refez e sai sem fazer nada.
 *
 * Nada aqui é chamado por ação de visitante: só as telas leem esta conta, e as
 * ações gravam sempre na conta da sessão (ver lib/guardas.ts).
 */
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { paraDataLocal } from "@/lib/formato";
import { carregarDadosDoMes } from "@/lib/relatorio/operacoes";
import { montarRelatorio } from "@/lib/relatorio/montar";
import { ID_DO_ESTUDIO_DE_EXEMPLO } from "./conta";
import { LINK_DO_EXEMPLO, montarEstudioDeExemplo } from "./dados";

/** Depois disso a agenda "de hoje" já não parece de hoje. */
export const HORAS_ATE_REFAZER = 12;

/** Se os dados criados em `criadoEm` já não servem para `agora`. */
export function precisaRefazer(criadoEm: Date, agora: Date) {
  if (agora.getTime() - criadoEm.getTime() > HORAS_ATE_REFAZER * 3_600_000) return true;
  if (criadoEm.getTime() > agora.getTime() + 60_000) return true; // Relógio voltou: refaz.
  return paraDataLocal(criadoEm) !== paraDataLocal(agora);
}

const comAssinatura = { assinatura: true } as const;
export type ContaDeExemplo = Prisma.UsuarioGetPayload<{ include: typeof comAssinatura }>;

/**
 * Devolve a conta de exemplo pronta para as telas, refazendo os dados antes se
 * estiverem velhos. Se refazer falhar e já houver uma versão antiga, as telas
 * mostram a antiga: uma demonstração de ontem é melhor que uma tela de erro.
 */
export async function estudioDeExemplo(db: PrismaClient, agora = new Date()): Promise<ContaDeExemplo> {
  const atual = await db.usuario.findUnique({
    where: { id: ID_DO_ESTUDIO_DE_EXEMPLO },
    include: comAssinatura,
  });
  if (atual && !precisaRefazer(atual.criadoEm, agora)) return atual;

  try {
    await refazerEstudioDeExemplo(db, agora);
  } catch (erro) {
    if (!atual) throw erro;
    console.error("Não consegui refazer o estúdio de exemplo; mostrando o anterior.", erro);
    return atual;
  }

  return db.usuario.findUniqueOrThrow({
    where: { id: ID_DO_ESTUDIO_DE_EXEMPLO },
    include: comAssinatura,
  });
}

/**
 * Apaga e grava de novo o estúdio de exemplo, se ainda for preciso. Devolve
 * true quando refez, false quando outro pedido já tinha refeito.
 */
export async function refazerEstudioDeExemplo(db: PrismaClient, agora = new Date(), forcar = false) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"demonstracao:estudio-de-exemplo"}, 0))`;

      // Quem esperou na fila confere de novo: o pedido da frente pode ter refeito.
      const atual = await tx.usuario.findUnique({
        where: { id: ID_DO_ESTUDIO_DE_EXEMPLO },
        select: { criadoEm: true },
      });
      if (atual && !forcar && !precisaRefazer(atual.criadoEm, agora)) return false;

      // A conta leva tudo junto em cascata, num comando só (inclusive os
      // pagamentos da equipe, que seguram lançamento e colaborador).
      await tx.usuario.deleteMany({ where: { id: ID_DO_ESTUDIO_DE_EXEMPLO } });

      const dados = montarEstudioDeExemplo(agora);

      /*
        O link público é único entre todos os estúdios. Se alguém de verdade já
        estiver usando o endereço de exemplo, a demonstração usa outro, em vez
        de falhar inteira por causa de um detalhe.
      */
      const linkEmUso = await tx.agendaOnline.findUnique({
        where: { link: LINK_DO_EXEMPLO },
        select: { usuarioId: true },
      });
      const agendaOnline = linkEmUso
        ? { ...dados.agendaOnline, link: `${LINK_DO_EXEMPLO}-${agora.getTime().toString(36)}` }
        : dados.agendaOnline;

      await tx.usuario.create({ data: dados.usuario });
      await tx.cliente.createMany({ data: dados.clientes });
      await tx.servico.createMany({ data: dados.servicos });
      await tx.colaborador.createMany({ data: dados.colaboradores });
      await tx.ausenciaDoColaborador.createMany({ data: dados.ausencias });
      await tx.agendamento.createMany({ data: dados.agendamentos });
      await tx.lancamento.createMany({ data: dados.lancamentos });
      await tx.pagamentoDeColaborador.createMany({ data: dados.pagamentosDaEquipe });
      await tx.cobranca.createMany({ data: dados.cobrancas });
      await tx.lembreteDeCobranca.createMany({ data: dados.lembretes });
      await tx.repeticaoDeVencimento.createMany({ data: dados.repeticoes });
      await tx.vencimento.createMany({ data: dados.vencimentos });
      await tx.documento.createMany({ data: dados.documentos });
      await tx.itemDoDocumento.createMany({ data: dados.itensDosDocumentos });
      await tx.conversaDeIa.createMany({ data: dados.conversas });
      await tx.mensagemDeIa.createMany({ data: dados.mensagens });
      await tx.usoDeIa.createMany({ data: dados.usosDeIa });
      await tx.agendaOnline.create({ data: agendaOnline });
      await tx.faixaDeAtendimento.createMany({ data: dados.faixas });
      await tx.acessoDoContador.create({ data: dados.acessoDoContador });

      // O mês passado aparece fechado, com o resumo congelado como a tela faria.
      const { competencia, fechadoEm } = dados.mesFechado;
      const relatorio = montarRelatorio(
        await carregarDadosDoMes(tx, ID_DO_ESTUDIO_DE_EXEMPLO, competencia, fechadoEm),
      );
      await tx.fechamentoDoMes.create({
        data: {
          usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO,
          competencia,
          fechado: true,
          resumo: relatorio as unknown as Prisma.InputJsonValue,
          fechadoEm,
        },
      });
      await tx.registroDeFechamento.create({
        data: { usuarioId: ID_DO_ESTUDIO_DE_EXEMPLO, competencia, acao: "fechou", criadoEm: fechadoEm },
      });

      return true;
    },
    // Na hospedagem o banco fica longe: folga para as ~25 gravações e para a fila da trava.
    { timeout: 60_000, maxWait: 30_000 },
  );
}
