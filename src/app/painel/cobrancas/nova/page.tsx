import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { dataEHora, hojeNoEstudio, paraDataPura } from "@/lib/formato";
import { FormularioDeCobranca } from "./formulario";

export const metadata = { title: "Nova cobrança" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaCobranca({
  searchParams,
}: {
  searchParams: Promise<{ agendamento?: string; cliente?: string }>;
}) {
  const { usuario } = await exigirRecurso("cobrar");
  const { agendamento: agendamentoId, cliente: clienteId } = await searchParams;

  // O horário é buscado com o estúdio da sessão junto: um id de outro estúdio
  // simplesmente não encontra nada.
  const agendamento = agendamentoId
    ? await prisma.agendamento.findFirst({
        where: { id: agendamentoId, usuarioId: usuario.id },
        select: {
          id: true,
          inicio: true,
          cliente: { select: { id: true, nome: true } },
          servico: { select: { nome: true, precoCentavos: true } },
        },
      })
    : null;

  if (agendamentoId && !agendamento) notFound();

  const clientes = agendamento
    ? []
    : await prisma.cliente.findMany({
        where: { usuarioId: usuario.id },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      });

  const escolhido = agendamento?.cliente.id ?? clienteId;
  if (clienteId && !agendamento) {
    const existe = await prisma.cliente.findFirst({
      where: { id: clienteId, usuarioId: usuario.id },
      select: { id: true },
    });
    if (!existe) notFound();
  }

  const valor = agendamento
    ? (agendamento.servico.precoCentavos / 100).toFixed(2).replace(".", ",")
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

      {!agendamento && clientes.length === 0 ? (
        <Vazio
          titulo="Você ainda não tem clientes"
          texto="Para cobrar, primeiro cadastre quem você atende."
          acao={{ rotulo: "Cadastrar um cliente", href: "/painel/clientes" }}
        />
      ) : (
        <Cartao>
          <FormularioDeCobranca
            clientes={clientes}
            clienteEscolhido={escolhido}
            agendamentoId={agendamento?.id}
            valorSugerido={valor}
            hoje={paraDataPura(hojeNoEstudio())}
          />
        </Cartao>
      )}
    </div>
  );
}
