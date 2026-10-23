/**
 * Receber uma cobrança, do jeito que a tela faz e o teste confere.
 *
 * A ação da tela chama esta função com o Prisma do servidor; o teste chama a
 * mesma função com o banco de teste. Toda consulta filtra pelo estúdio.
 */
import type { PrismaClient } from "@/generated/prisma";
import { instanteDoDiaPuro } from "@/lib/formato";
import {
  conferirMesesAbertos,
  mesDoDiaPuro,
  mesDoInstante,
  mesFechadoEntre,
} from "@/lib/fechamento/trava";

type Banco = PrismaClient;

export const FORMAS_DE_PAGAMENTO = ["pix", "dinheiro", "cartao", "outra"] as const;

export type ResultadoDoRecebimento =
  | { erro: string }
  | { resultado: "paga" | "ja_paga" };

export async function receberCobranca(
  db: Banco,
  usuarioId: string,
  entrada: { id: string; forma: string; pagaEm: Date },
): Promise<ResultadoDoRecebimento> {
  const cobranca = await db.cobranca.findFirst({
    where: { id: entrada.id, usuarioId },
    select: {
      id: true,
      situacao: true,
      valorCentavos: true,
      agendamentoId: true,
      cliente: { select: { nome: true } },
    },
  });
  if (!cobranca) return { erro: "Não encontramos essa cobrança." };
  if (cobranca.situacao === "paga") return { resultado: "ja_paga" };
  if (cobranca.situacao === "cancelada") {
    return { erro: "Essa cobrança foi cancelada. Crie outra se precisar cobrar de novo." };
  }

  return db.$transaction(async (tx) => {
    /*
      O dia do pagamento decide o mês: a cobrança avulsa vira entrada nele, e
      a da agenda deixa de estar "em aberto" nele. Nos dois casos, mês fechado
      não muda.
    */
    const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoDiaPuro(entrada.pagaEm)]);
    if (fechado) return { erro: fechado.erro };

    /*
      A condição `situacao: "aberta"` dentro do próprio UPDATE é o que impede o
      dinheiro de entrar duas vezes. Se dois toques chegarem juntos, o primeiro
      muda uma linha e o segundo muda zero; só quem mudou linha segue adiante e
      cria o lançamento.
    */
    const mudadas = await tx.cobranca.updateMany({
      where: { id: cobranca.id, usuarioId, situacao: "aberta" },
      data: { situacao: "paga", formaDePagamento: entrada.forma, pagaEm: entrada.pagaEm },
    });
    if (mudadas.count === 0) return { resultado: "ja_paga" as const };

    /*
      Onde este dinheiro aparece no faturamento depende de onde ele nasceu.

      Cobrança que veio de um horário da agenda NÃO vira lançamento: o
      faturamento do mês já soma o preço de todo atendimento concluído. Criar
      um lançamento aqui contaria o mesmo dinheiro duas vezes. O que ela faz é
      passar o valor recebido para o preço do atendimento: quem cobrou R$ 40,00
      por um serviço de R$ 45,00 vê R$ 40,00 nas Finanças, no Relatório e na
      base da comissão, e não o preço da tabela.

      A exceção é o atendimento concluído num mês já fechado: o resumo daquele
      mês está congelado com o preço antigo, e mudar o atendimento por trás
      deixaria o mês com dois números.

      Cobrança solta, criada pela ficha do cliente, não tem atendimento por
      trás, então ela precisa virar entrada para aparecer no mês.
    */
    if (cobranca.agendamentoId) {
      const atendimento = await tx.agendamento.findFirst({
        where: { id: cobranca.agendamentoId, usuarioId },
        select: { id: true, inicio: true, status: true, precoCentavos: true },
      });
      if (atendimento && atendimento.precoCentavos !== cobranca.valorCentavos) {
        const mesCongelado =
          atendimento.status === "concluido" &&
          (await mesFechadoEntre(tx, usuarioId, [mesDoInstante(atendimento.inicio)]));
        if (!mesCongelado) {
          await tx.agendamento.updateMany({
            where: { id: atendimento.id, usuarioId },
            data: { precoCentavos: cobranca.valorCentavos },
          });
        }
      }
      return { resultado: "paga" as const };
    }

    const lancamento = await tx.lancamento.create({
      data: {
        usuarioId,
        tipo: "entrada",
        descricao: `Cobrança de ${cobranca.cliente.nome}`,
        categoria: "Cobrança",
        valorCentavos: cobranca.valorCentavos,
        // Dia puro vira meia-noite em São Paulo; senão aparece um dia antes.
        data: instanteDoDiaPuro(entrada.pagaEm),
      },
      select: { id: true },
    });

    await tx.cobranca.update({
      where: { id: cobranca.id },
      data: { lancamentoId: lancamento.id },
    });
    return { resultado: "paga" as const };
  });
}
