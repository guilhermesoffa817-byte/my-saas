import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { Vazio } from "@/componentes/ui/estados";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/ui/botao";
import { emReais } from "@/lib/formato";
import { FormularioServico } from "./formulario";
import { alternarServico, removerServico } from "./acoes";

export const metadata = { title: "Serviços" };
export const dynamic = "force-dynamic";

export default async function PaginaServicos() {
  const { usuario } = await exigirAcesso();

  const servicos = await prisma.servico.findMany({
    where: { usuarioId: usuario.id },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { agendamentos: true } } },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">Seus serviços</h1>
        <p className="mt-2 text-carvao-suave">
          Cadastre o que você oferece com preço e duração. Na hora de marcar um horário,
          é só escolher da lista.
        </p>
      </section>

      <section className="cartao p-4 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-carvao">Novo serviço</h2>
        <p className="mt-1 mb-5 text-sm text-carvao-suave">
          O preço vira o valor combinado de cada horário marcado. Mudar depois vale
          para os próximos, sem mexer nos que já foram marcados.
        </p>
        <FormularioServico />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Cardápio do estúdio{" "}
          <span className="text-base font-normal text-carvao-suave">({servicos.length})</span>
        </h2>

        {servicos.length === 0 ? (
          <Vazio
            titulo="Nenhum serviço cadastrado ainda"
            texto="Comece pelos seus carros-chefe, aqueles que a maioria dos clientes pede."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {servicos.map((servico) => (
              <li
                key={servico.id}
                className={`cartao min-w-0 p-4 sm:p-6 ${servico.ativo ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold break-words text-carvao">
                      {servico.nome}
                    </p>
                    <p className="text-sm text-carvao-suave">
                      {emReais(servico.precoCentavos)} · {servico.duracaoMin} min
                    </p>
                  </div>
                  <span
                    className={`etiqueta shrink-0 border whitespace-nowrap ${
                      servico.ativo
                        ? "border-oliva/30 bg-oliva/10 text-oliva"
                        : "border-areia-escura bg-areia/50 text-carvao-suave"
                    }`}
                  >
                    {servico.ativo ? "No cardápio" : "Fora do cardápio"}
                  </span>
                </div>

                {servico.descricao ? (
                  <p className="mt-3 text-sm leading-relaxed break-words text-carvao-suave">
                    {servico.descricao}
                  </p>
                ) : null}

                {/*
                  As três ações cabem numa linha só em 390px: as duas de caixa
                  com um respiro lateral menor, e o "Apagar" sem caixa, em
                  vermelho. Num celular mais estreito, descem juntas. Aberta, a
                  edição ocupa a largura toda.
                */}
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  <details className="open:w-full">
                    <summary className="botao-suave cursor-pointer list-none px-4 [&::-webkit-details-marker]:hidden">
                      Editar
                    </summary>
                    <div className="mt-4 rounded-2xl bg-creme p-4">
                      <FormularioServico
                        servico={{
                          id: servico.id,
                          nome: servico.nome,
                          preco: (servico.precoCentavos / 100).toFixed(2).replace(".", ","),
                          duracaoMin: servico.duracaoMin,
                          descricao: servico.descricao,
                        }}
                      />
                    </div>
                  </details>

                  {/*
                    Tirar do cardápio esconde o serviço na hora de marcar, sem
                    apagar nada. Antes o botão se chamava "Guardar", e quem
                    tocava achava que estava salvando.
                  */}
                  <form action={alternarServico}>
                    <input type="hidden" name="id" value={servico.id} />
                    <BotaoEnviar variante="suave" className="px-4">
                      {servico.ativo ? "Tirar do cardápio" : "Voltar ao cardápio"}
                    </BotaoEnviar>
                  </form>

                  {/*
                    Serviço com atendimento no histórico não pode ser apagado:
                    os horários antigos apontam para ele. Para esse, o caminho
                    é tirar do cardápio, então o botão de apagar nem aparece.
                  */}
                  {servico._count.agendamentos === 0 ? (
                    <form action={removerServico}>
                      <input type="hidden" name="id" value={servico.id} />
                      <BotaoConfirmar
                        pergunta={`Apagar ${servico.nome} de vez? Ele ainda não tem nenhum atendimento, então some da lista.`}
                        variante="texto"
                        className="min-h-11 text-rose-600"
                      >
                        Apagar
                      </BotaoConfirmar>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
