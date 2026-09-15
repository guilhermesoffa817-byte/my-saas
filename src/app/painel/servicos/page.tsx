import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { Vazio } from "@/componentes/avisos";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/botoes";
import { emReais } from "@/lib/formato";
import { FormularioServico } from "./formulario";
import { alternarServico, removerServico } from "./acoes";

export const metadata = { title: "Serviços — Agenda Online" };
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
        <h1 className="font-display text-3xl font-semibold text-carvao">Seus serviços</h1>
        <p className="mt-2 text-carvao-suave">
          Cadastre o que você oferece com preço e duração. Na hora de marcar um horário,
          é só escolher da lista.
        </p>
      </section>

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">Novo serviço</h2>
        <p className="mt-1 mb-5 text-sm text-carvao-suave">
          O preço entra no cálculo do faturamento quando o atendimento for concluído.
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
            texto="Comece pelos seus carros-chefe: limpeza de pele, design de sobrancelha, massagem..."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {servicos.map((servico) => (
              <li key={servico.id} className={`cartao ${servico.ativo ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-carvao">
                      {servico.nome}
                    </p>
                    <p className="text-sm text-carvao-suave">
                      {emReais(servico.precoCentavos)} · {servico.duracaoMin} min
                    </p>
                  </div>
                  <span
                    className={`etiqueta border ${
                      servico.ativo
                        ? "border-oliva/30 bg-oliva/10 text-oliva"
                        : "border-areia-escura bg-areia/50 text-carvao-suave"
                    }`}
                  >
                    {servico.ativo ? "No cardápio" : "Guardado"}
                  </span>
                </div>

                {servico.descricao ? (
                  <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
                    {servico.descricao}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <details className="w-full">
                    <summary className="botao-suave cursor-pointer list-none">Editar</summary>
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

                  <form action={alternarServico}>
                    <input type="hidden" name="id" value={servico.id} />
                    <BotaoEnviar variante="suave">
                      {servico.ativo ? "Guardar" : "Voltar para o cardápio"}
                    </BotaoEnviar>
                  </form>

                  <form action={removerServico}>
                    <input type="hidden" name="id" value={servico.id} />
                    <BotaoConfirmar
                      pergunta={
                        servico._count.agendamentos > 0
                          ? `${servico.nome} já tem atendimentos no histórico, então ele será apenas guardado. Tudo bem?`
                          : `Apagar ${servico.nome} da sua lista?`
                      }
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
