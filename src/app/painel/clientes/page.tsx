import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { Vazio } from "@/componentes/avisos";
import { BotaoConfirmar } from "@/componentes/botoes";
import { dataCurta, paraDataLocal, telefoneBonito } from "@/lib/formato";
import { FormularioCliente } from "./formulario";
import { excluirCliente } from "./acoes";

export const metadata = { title: "Clientes — Ateliê" };
export const dynamic = "force-dynamic";

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { usuario } = await exigirAcesso();
  const { busca = "" } = await searchParams;
  const termo = busca.trim();

  const clientes = await prisma.cliente.findMany({
    where: {
      usuarioId: usuario.id,
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo } },
              { telefone: { contains: termo } },
              { email: { contains: termo } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: { _count: { select: { agendamentos: true } } },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-semibold text-carvao">Suas clientes</h1>
        <p className="mt-2 text-carvao-suave">
          A ficha de cada uma fica guardada aqui: contato, aniversário e aquelas
          observações que fazem toda a diferença no atendimento.
        </p>
      </section>

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">Nova cliente</h2>
        <p className="mt-1 mb-5 text-sm text-carvao-suave">
          Só o nome e o WhatsApp já bastam para começar.
        </p>
        <FormularioCliente />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-carvao">
            Lista de clientes{" "}
            <span className="text-base font-normal text-carvao-suave">
              ({clientes.length})
            </span>
          </h2>

          <form className="flex gap-2">
            <input
              name="busca"
              defaultValue={termo}
              className="campo py-2"
              placeholder="Procurar por nome ou telefone"
              aria-label="Procurar cliente"
            />
            <button type="submit" className="botao-suave">
              Procurar
            </button>
          </form>
        </div>

        {clientes.length === 0 ? (
          <Vazio
            titulo={termo ? "Não achei ninguém com esse nome" : "Sua lista ainda está vazia"}
            texto={
              termo
                ? "Tente procurar por outra parte do nome ou pelo telefone."
                : "Cadastre a primeira cliente no formulário acima — leva menos de um minuto."
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {clientes.map((cliente) => (
              <li key={cliente.id} className="cartao">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-carvao">
                      {cliente.nome}
                    </p>
                    <p className="text-sm text-carvao-suave">
                      {telefoneBonito(cliente.telefone)}
                      {cliente.email ? ` · ${cliente.email}` : ""}
                    </p>
                  </div>
                  <span className="etiqueta border border-areia-escura bg-areia/50 text-carvao-suave">
                    {cliente._count.agendamentos}{" "}
                    {cliente._count.agendamentos === 1 ? "visita" : "visitas"}
                  </span>
                </div>

                {cliente.nascimento ? (
                  <p className="mt-3 text-sm text-carvao-suave">
                    Aniversário em {dataCurta(cliente.nascimento)}
                  </p>
                ) : null}

                {cliente.observacoes ? (
                  <p className="mt-3 rounded-2xl bg-areia/40 px-4 py-3 text-sm leading-relaxed text-carvao-suave">
                    {cliente.observacoes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <details className="w-full">
                    <summary className="botao-suave cursor-pointer list-none">
                      Editar ficha
                    </summary>
                    <div className="mt-4 rounded-2xl bg-creme p-4">
                      <FormularioCliente
                        cliente={{
                          id: cliente.id,
                          nome: cliente.nome,
                          telefone: cliente.telefone,
                          email: cliente.email,
                          nascimento: cliente.nascimento
                            ? paraDataLocal(cliente.nascimento)
                            : null,
                          observacoes: cliente.observacoes,
                        }}
                      />
                    </div>
                  </details>

                  <form action={excluirCliente}>
                    <input type="hidden" name="id" value={cliente.id} />
                    <BotaoConfirmar
                      pergunta={`Apagar ${cliente.nome} e todos os agendamentos dela? Isso não tem volta.`}
                      className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                    >
                      Apagar
                    </BotaoConfirmar>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
