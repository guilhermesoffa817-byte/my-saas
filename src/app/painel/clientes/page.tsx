import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { agoraDoPedido } from "@/lib/agora";
import { Vazio } from "@/componentes/ui/estados";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { mudarLembretesDoCliente } from "../cobrancas/acoes";
import { cpfBonito, dataCurta, paraDataLocal, telefoneBonito } from "@/lib/formato";
import { temHistorico } from "@/lib/historico";
import { FormularioCliente } from "./formulario";
import { BotaoDesarquivar, BotaoTirarDaLista } from "./tirar-da-lista";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string | string[]; arquivadas?: string | string[] }>;
}) {
  const { usuario } = await exigirAcesso();
  const { busca, arquivadas } = await searchParams;
  // O endereço é digitável: um parâmetro repetido chega como lista, e um texto
  // enorme não tem por que ir parar numa consulta.
  const termo = typeof busca === "string" ? busca.trim().slice(0, 100) : "";
  const digitos = termo.replace(/\D/g, "");
  const verArquivadas = arquivadas === "1";

  const agora = agoraDoPedido();

  const [clientes, quantasArquivadas, marcados] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        usuarioId: usuario.id,
        // Arquivada sai da lista do dia a dia, mas continua a um toque de distância.
        arquivadoEm: verArquivadas ? { not: null } : null,
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" } },
                { telefone: { contains: termo } },
                { email: { contains: termo, mode: "insensitive" } },
                // Sem dígito na busca, "CPF contém nada" acharia todo mundo que tem CPF.
                ...(digitos ? [{ cpf: { contains: digitos } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        cpf: true,
        endereco: true,
        nascimento: true,
        observacoes: true,
        semLembretes: true,
        _count: {
          select: {
            // Visita é atendimento concluído. Cancelado e falta não contam.
            agendamentos: { where: { status: "concluido" } },
            cobrancas: true,
          },
        },
        // Basta saber se existe algum horário, de qualquer situação, para
        // decidir entre apagar e arquivar.
        agendamentos: { select: { id: true }, take: 1 },
      },
    }),
    prisma.cliente.count({
      where: { usuarioId: usuario.id, arquivadoEm: { not: null } },
    }),
    // Os horários de pé daqui para a frente, por cliente. Arquivar cancela
    // esses horários, e a pergunta antes do toque diz quantos são.
    verArquivadas
      ? Promise.resolve([])
      : prisma.agendamento.groupBy({
          by: ["clienteId"],
          where: { usuarioId: usuario.id, status: "agendado", inicio: { gte: agora } },
          _count: { _all: true },
        }),
  ]);

  const marcadosPorCliente = new Map(
    marcados.map((linha) => [linha.clienteId, linha._count._all]),
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
          {verArquivadas ? "Fichas arquivadas" : "Seus clientes"}
        </h1>
        <p className="mt-2 text-carvao-suave">
          {verArquivadas
            ? "Quem saiu da lista continua aqui, com o histórico guardado. Os atendimentos e as cobranças pagas seguem contando no faturamento."
            : "A ficha de cada uma fica guardada aqui: contato, aniversário e aquelas observações que fazem toda a diferença no atendimento."}
        </p>
      </section>

      {!verArquivadas ? (
        <section className="cartao p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-carvao">Novo cliente</h2>
          <p className="mt-1 mb-5 text-sm text-carvao-suave">
            Só o nome e o WhatsApp já bastam para começar.
          </p>
          <FormularioCliente />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-carvao">
            {verArquivadas ? "Arquivadas" : "Lista de clientes"}{" "}
            <span className="text-base font-normal text-carvao-suave">
              ({clientes.length})
            </span>
          </h2>

          <form className="flex w-full gap-2 sm:w-auto">
            {verArquivadas ? <input type="hidden" name="arquivadas" value="1" /> : null}
            <input
              name="busca"
              defaultValue={termo}
              maxLength={100}
              className="campo min-w-0 flex-1 py-2 sm:w-72"
              placeholder="Buscar nome ou telefone"
              aria-label="Buscar cliente"
            />
            <button type="submit" className="botao-suave shrink-0">
              Buscar
            </button>
          </form>
        </div>

        {/*
          O caminho para as arquivadas fica logo abaixo da busca, e não no fim
          da lista: com muitas clientes, ninguém rola até o fim para achar.
        */}
        {verArquivadas ? (
          <Link href="/painel/clientes" className="botao-texto -ml-3">
            Voltar para a lista
          </Link>
        ) : quantasArquivadas > 0 ? (
          <Link href="/painel/clientes?arquivadas=1" className="botao-texto -ml-3">
            Ver arquivadas ({quantasArquivadas})
          </Link>
        ) : null}

        {clientes.length === 0 ? (
          <Vazio
            titulo={
              termo
                ? "Não achei ninguém com esse nome"
                : verArquivadas
                  ? "Nenhuma ficha arquivada"
                  : "Sua lista ainda está vazia"
            }
            texto={
              termo
                ? "Tente buscar por outra parte do nome ou pelo telefone."
                : verArquivadas
                  ? "Quando você arquivar alguém com histórico, a ficha fica guardada aqui."
                  : "Cadastre o primeiro cliente no formulário acima. Leva menos de um minuto."
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {clientes.map((cliente) => {
              const visitas = cliente._count.agendamentos;
              const comHistorico = temHistorico({
                atendimentos: cliente.agendamentos.length,
                cobrancas: cliente._count.cobrancas,
              });

              return (
                <li key={cliente.id} className="cartao min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/painel/clientes/${cliente.id}`}
                        className="font-display text-lg font-semibold break-words text-carvao underline decoration-areia-escura decoration-2 underline-offset-4 transition hover:text-terracota hover:decoration-terracota"
                      >
                        {cliente.nome}
                      </Link>
                      <p className="mt-0.5 text-sm wrap-anywhere text-carvao-suave">
                        {telefoneBonito(cliente.telefone)}
                        {cliente.email ? ` · ${cliente.email}` : ""}
                      </p>
                    </div>
                    <span className="etiqueta shrink-0 border border-areia-escura bg-areia/50 whitespace-nowrap text-carvao-suave">
                      {visitas} {visitas === 1 ? "visita" : "visitas"}
                    </span>
                  </div>

                  {cliente.semLembretes || verArquivadas ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {verArquivadas ? <Etiqueta tom="calma">Arquivada</Etiqueta> : null}
                      {cliente.semLembretes ? (
                        <Etiqueta tom="calma">Sem lembretes</Etiqueta>
                      ) : null}
                    </div>
                  ) : null}

                  {cliente.cpf || cliente.endereco || cliente.nascimento ? (
                    <dl className="mt-3 space-y-1 text-sm text-carvao-suave">
                      {cliente.cpf ? (
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium">CPF:</dt>
                          <dd className="min-w-0">{cpfBonito(cliente.cpf)}</dd>
                        </div>
                      ) : null}
                      {cliente.endereco ? (
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium">Endereço:</dt>
                          <dd className="min-w-0 break-words">{cliente.endereco}</dd>
                        </div>
                      ) : null}
                      {cliente.nascimento ? (
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium">Aniversário:</dt>
                          <dd className="min-w-0">{dataCurta(cliente.nascimento)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}

                  {cliente.observacoes ? (
                    <p className="mt-3 rounded-2xl bg-areia/40 px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-line text-carvao-suave">
                      {cliente.observacoes}
                    </p>
                  ) : null}

                  {verArquivadas ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <BotaoDesarquivar id={cliente.id} />
                      <Link href={`/painel/clientes/${cliente.id}`} className="botao-texto">
                        Ver histórico
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/painel/cobrancas/nova?cliente=${cliente.id}`}
                          className="botao-suave"
                        >
                          Cobrar
                        </Link>

                        {/*
                          Quem pede para não receber aviso sai da lista "Para lembrar
                          hoje". Continua sendo possível cobrar: o que muda é o Bossa
                          parar de sugerir.
                        */}
                        <form action={mudarLembretesDoCliente}>
                          <input type="hidden" name="id" value={cliente.id} />
                          <input
                            type="hidden"
                            name="semLembretes"
                            value={cliente.semLembretes ? "0" : "1"}
                          />
                          <BotaoEnviar variante="texto">
                            {cliente.semLembretes
                              ? "Voltar a enviar lembretes"
                              : "Não enviar lembretes"}
                          </BotaoEnviar>
                        </form>
                      </div>

                      {/*
                        Editar e arquivar dividem a mesma linha enquanto cabem.
                        Aberta, a ficha ocupa a largura toda e o botão de
                        arquivar desce para depois dela.
                      */}
                      <div className="mt-2 flex flex-wrap items-start gap-2">
                        <details className="open:w-full">
                          <summary className="botao-suave cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            Editar ficha
                          </summary>
                          <div className="mt-4 rounded-2xl bg-creme p-4">
                            <FormularioCliente
                              cliente={{
                                id: cliente.id,
                                nome: cliente.nome,
                                telefone: cliente.telefone,
                                email: cliente.email,
                                cpf: cliente.cpf,
                                endereco: cliente.endereco,
                                nascimento: cliente.nascimento
                                  ? paraDataLocal(cliente.nascimento)
                                  : null,
                                observacoes: cliente.observacoes,
                              }}
                            />
                          </div>
                        </details>

                        <BotaoTirarDaLista
                          id={cliente.id}
                          nome={cliente.nome}
                          comHistorico={comHistorico}
                          horariosMarcados={marcadosPorCliente.get(cliente.id) ?? 0}
                        />
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
