import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Aviso, Etiqueta, ROTULO_DA_COBRANCA, TOM_DA_COBRANCA } from "@/componentes/ui/etiqueta";
import { BotaoConfirmar, BotaoCopiar } from "@/componentes/ui/botao";
import {
  dataEHora,
  dataPuraCurta,
  emReais,
  hojeNoEstudio,
  paraDataPura,
  telefoneBonito,
} from "@/lib/formato";
import {
  identificadorDoPix,
  lembreteDeHoje,
  montarMensagem,
  prazoPorExtenso,
  situacaoDaCobranca,
  type CodigoDoMomento,
  type PreferenciaDeLembrete,
  type Tom,
} from "@/lib/cobranca";
import { montarPix } from "@/lib/pix";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import { qrCodeSvg } from "@/lib/qrcode";
import { Mensagem } from "./mensagem";
import { FormularioDePagamento } from "./pagamento";
import { cancelarCobranca } from "../acoes";

export const metadata = { title: "Cobrança" };
export const dynamic = "force-dynamic";

export default async function PaginaDaCobranca({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { usuario } = await exigirRecurso("cobrar");
  const { id } = await params;

  // O estúdio da sessão entra na busca. Cobrança de outro estúdio não é
  // "proibida": ela simplesmente não existe para quem perguntou.
  const cobranca = await prisma.cobranca.findFirst({
    where: { id, usuarioId: usuario.id },
    select: {
      id: true,
      valorCentavos: true,
      vencimento: true,
      situacao: true,
      formaDePagamento: true,
      pagaEm: true,
      agendamentoId: true,
      cliente: { select: { id: true, nome: true, telefone: true, semLembretes: true } },
      agendamento: {
        select: { inicio: true, status: true, servico: { select: { nome: true } } },
      },
      lembretes: { select: { momento: true, enviadoEm: true } },
    },
  });

  if (!cobranca) notFound();

  const hoje = hojeNoEstudio();
  const situacao = situacaoDaCobranca(cobranca, hoje);
  const aberta = situacao === "aberta" || situacao === "atrasada";

  /* O código Pix, quando o estúdio já cadastrou a chave. */
  const pix =
    usuario.pixChave && usuario.pixCidade
      ? montarPix({
          chave: usuario.pixChave,
          nome: usuario.nomeNegocio,
          cidade: usuario.pixCidade,
          valorCentavos: cobranca.valorCentavos,
          identificador: identificadorDoPix(cobranca.vencimento),
        })
      : null;

  const codigoPix = pix?.certo ? pix.codigo : null;
  const qr = codigoPix ? await qrCodeSvg(codigoPix) : null;

  /* Os três textos, prontos, para a tela só trocar entre eles. */
  const comuns = {
    nomeDoCliente: cobranca.cliente.nome,
    nomeDoEstudio: usuario.nomeNegocio,
    valorCentavos: cobranca.valorCentavos,
    vencimento: cobranca.vencimento,
    hoje,
    codigoPix,
  };
  const textos: Record<Tom, string> = {
    gentil: montarMensagem({ ...comuns, tom: "gentil" }),
    direto: montarMensagem({ ...comuns, tom: "direto" }),
    firme: montarMensagem({ ...comuns, tom: "firme" }),
  };

  const preferencias: PreferenciaDeLembrete = {
    antes: usuario.lembreteAntes,
    no_dia: usuario.lembreteNoDia,
    tres_dias: usuario.lembreteTresDias,
    sete_dias: usuario.lembreteSeteDias,
  };
  const escolha = lembreteDeHoje({
    vencimento: cobranca.vencimento,
    hoje,
    preferencias,
    jaEnviados: cobranca.lembretes.map((item) => item.momento as CodigoDoMomento),
  });

  const temLembretes = podeUsar(usuario, "lembretes");
  const tomSugerido: Tom = escolha?.momento.tomSugerido ?? (situacao === "atrasada" ? "direto" : "gentil");

  const telefone = telefoneParaWhatsApp(cobranca.cliente.telefone);
  const linkBase = telefone.certo ? linkDoWhatsApp(telefone.paraWhatsApp, "") : null;

  return (
    <div className="space-y-6">
      <TituloDaTela
        explicacao={`${cobranca.cliente.nome} · ${telefoneBonito(cobranca.cliente.telefone)}`}
      >
        {emReais(cobranca.valorCentavos)}
      </TituloDaTela>

      <div className="flex flex-wrap items-center gap-3">
        <Etiqueta tom={TOM_DA_COBRANCA[situacao]}>{ROTULO_DA_COBRANCA[situacao]}</Etiqueta>
        <span className="text-sm text-carvao-suave">
          {situacao === "paga"
            ? `Paga em ${cobranca.pagaEm ? dataPuraCurta(cobranca.pagaEm) : "data não registrada"}`
            : `${prazoPorExtenso(cobranca.vencimento, hoje)} · ${dataPuraCurta(cobranca.vencimento)}`}
        </span>
      </div>

      {cobranca.agendamento ? (
        <p className="text-sm text-carvao-suave">
          Do atendimento de {cobranca.agendamento.servico.nome}, em{" "}
          {dataEHora(cobranca.agendamento.inicio)}.
        </p>
      ) : null}

      {!telefone.certo && aberta ? <Aviso tom="atencao">{telefone.motivo}</Aviso> : null}

      {usuario.pixChave && pix && !pix.certo ? (
        <Aviso tom="atencao">
          {pix.motivo} Enquanto isso, a mensagem sai sem o código Pix.
        </Aviso>
      ) : null}

      {!usuario.pixChave ? (
        <Aviso tom="calma">
          Você ainda não cadastrou sua chave Pix, então a mensagem sai sem o
          código de pagamento.{" "}
          <Link href="/painel/cobrancas/ajustes" className="font-semibold underline">
            Cadastrar agora
          </Link>
        </Aviso>
      ) : null}

      {aberta ? (
        <Secao titulo="Mandar a mensagem">
          <Cartao>
            <Mensagem
              textos={textos}
              tomSugerido={tomSugerido}
              linkBase={linkBase}
              cobrancaId={cobranca.id}
              podeLembrar={temLembretes && !cobranca.cliente.semLembretes && escolha !== null}
              avisoDoLembrete={
                cobranca.cliente.semLembretes
                  ? "Esse cliente pediu para não receber lembrete, então o Bossa não vai sugerir outro aviso."
                  : !temLembretes
                    ? "Guardar o histórico de lembretes faz parte do plano VIP. A mensagem você manda do mesmo jeito."
                    : "Nenhum lembrete pendente para hoje. O envio não precisa ser registrado."
              }
            />
          </Cartao>
        </Secao>
      ) : null}

      {codigoPix && aberta ? (
        <Secao
          titulo="Pix para pagar na hora"
          explicacao="Para quem vai pagar aí no balcão: é só apontar a câmera."
        >
          <Cartao>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div
                className="w-40 shrink-0 rounded-xl bg-white p-2"
                /* O SVG vem do gerador de QR Code do próprio projeto, não da rede. */
                dangerouslySetInnerHTML={{ __html: qr ?? "" }}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm text-carvao-suave">
                  Em nome de {usuario.nomeNegocio} · {emReais(cobranca.valorCentavos)}
                </p>
                <p className="font-mono text-xs leading-relaxed break-all text-carvao-suave select-all">
                  {codigoPix}
                </p>
                <BotaoCopiar texto={codigoPix} rotulo="Copiar código Pix" />
              </div>
            </div>
          </Cartao>
        </Secao>
      ) : null}

      {aberta ? (
        <Secao
          titulo="Recebeu?"
          explicacao={
            cobranca.agendamentoId
              ? "Esse dinheiro entra no faturamento pelo atendimento concluído na agenda, para não ser contado duas vezes."
              : "Ao marcar como paga, o valor entra como entrada nas suas finanças."
          }
        >
          <Cartao>
            <FormularioDePagamento
              cobrancaId={cobranca.id}
              hoje={paraDataPura(hoje)}
            />
          </Cartao>

          {cobranca.agendamento && cobranca.agendamento.status !== "concluido" ? (
            <Aviso tom="atencao">
              O atendimento ainda não está marcado como concluído na agenda, então
              ele não entrou no faturamento do mês. Marque como concluído quando
              atender.
            </Aviso>
          ) : null}
        </Secao>
      ) : null}

      {cobranca.lembretes.length > 0 ? (
        <Secao titulo="Lembretes enviados">
          <ul className="space-y-2 text-sm text-carvao-suave">
            {cobranca.lembretes.map((lembrete) => (
              <li key={lembrete.momento}>
                {dataEHora(lembrete.enviadoEm)}
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-areia-escura/60 pt-5">
        <Link href="/painel/cobrancas" className="botao-suave">
          Voltar para as cobranças
        </Link>
        {aberta ? (
          <form action={cancelarCobranca}>
            <input type="hidden" name="id" value={cobranca.id} />
            <BotaoConfirmar
              pergunta={`Cancelar a cobrança de ${emReais(cobranca.valorCentavos)} de ${cobranca.cliente.nome}?`}
              className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
            >
              Cancelar cobrança
            </BotaoConfirmar>
          </form>
        ) : null}
      </div>
    </div>
  );
}
