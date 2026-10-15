import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { valorDoAtendimento } from "@/lib/atendimento";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { Aviso } from "@/componentes/ui/etiqueta";
import { dataEHora, hojeNoEstudio, paraDataPura } from "@/lib/formato";
import { FormularioDeCobranca } from "./formulario";

export const metadata = { title: "Nova cobrança" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaCobranca({
  searchParams,
}: {
  searchParams: Promise<{ agendamento?: string | string[]; cliente?: string | string[] }>;
}) {
  const { usuario } = await exigirRecurso("cobrar");
  const parametros = await searchParams;
  // Um parâmetro repetido no endereço chega como lista; só um texto simples vale.
  const agendamentoId =
    typeof parametros.agendamento === "string" ? parametros.agendamento : undefined;
  const clienteId = typeof parametros.cliente === "string" ? parametros.cliente : undefined;

  // O horário é buscado com o estúdio da sessão junto: um id de outro estúdio
  // simplesmente não encontra nada.
  const agendamento = agendamentoId
    ? await prisma.agendamento.findFirst({
        where: { id: agendamentoId, usuarioId: usuario.id },
        select: {
          id: true,
          inicio: true,
          valorCentavos: true,
          cliente: { select: { id: true, nome: true } },
          servico: { select: { nome: true, precoCentavos: true } },
        },
      })
    : null;

  if (agendamentoId && !agendamento) notFound();

  // A ficha que veio pelo endereço, da lista de clientes ou da ficha dela.
  // Mesma regra: só vale se for deste estúdio.
  const pedida =
    !agendamento && clienteId
      ? await prisma.cliente.findFirst({
          where: { id: clienteId, usuarioId: usuario.id },
          select: { id: true, nome: true, arquivadoEm: true },
        })
      : null;

  if (clienteId && !agendamento && !pedida) notFound();

  // Ficha arquivada não entra na lista de escolha: ela saiu do dia a dia.
  const clientes = agendamento
    ? []
    : await prisma.cliente.findMany({
        where: { usuarioId: usuario.id, arquivadoEm: null },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      });

  const preEscolhida = pedida && !pedida.arquivadoEm ? pedida.id : undefined;

  // O valor sugerido é o combinado na hora de marcar, não o preço de hoje do
  // serviço: se o preço subiu depois, a cliente paga o que combinou.
  const valor = agendamento
    ? (valorDoAtendimento(agendamento) / 100).toFixed(2).replace(".", ",")
    : "";

  return (
    <div className="space-y-6">
      <TituloDaTela
        explicacao={
          agendamento
            ? `${agendamento.cliente.nome} · ${agendamento.servico.nome} · ${dataEHora(agendamento.inicio)}`
            : "Confira o valor e o prazo. A mensagem vem na tela seguinte."
        }
      >
        Cobrar
      </TituloDaTela>

      {pedida?.arquivadoEm ? (
        <Aviso tom="atencao">
          A ficha de {pedida.nome} está arquivada. Para cobrar dela,{" "}
          <Link href={`/painel/clientes/${pedida.id}`} className="font-semibold underline">
            desarquive a ficha
          </Link>{" "}
          primeiro.
        </Aviso>
      ) : null}

      {!agendamento && clientes.length === 0 ? (
        <Vazio
          titulo="Nenhum cliente na sua lista"
          texto="Para cobrar, primeiro cadastre quem você atende."
          acao={{ rotulo: "Cadastrar um cliente", href: "/painel/clientes" }}
        />
      ) : (
        <Cartao>
          <FormularioDeCobranca
            clientes={clientes}
            clienteDoHorario={agendamento?.cliente.id}
            clienteEscolhido={preEscolhida}
            agendamentoId={agendamento?.id}
            valorSugerido={valor}
            hoje={paraDataPura(hojeNoEstudio())}
          />
        </Cartao>
      )}
    </div>
  );
}
