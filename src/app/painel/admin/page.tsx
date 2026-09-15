import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { Etiqueta, Vazio } from "@/componentes/avisos";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/botoes";
import { avaliarAssinatura, PLANO } from "@/lib/assinatura";
import {
  competenciaPorExtenso,
  dataCurta,
  dataEHora,
  emReais,
  telefoneBonito,
} from "@/lib/formato";
import { confirmarPagamento, darCortesia, recusarPagamento } from "./acoes";

export const metadata = { title: "Pagamentos — Agenda Online" };
export const dynamic = "force-dynamic";

const rotuloStatus = {
  teste: "Em teste",
  ativa: "Em dia",
  aguardando: "Conferindo",
  expirada: "Vencida",
} as const;

export default async function PaginaAdmin() {
  await exigirAdmin();

  const [aguardando, assinantes, confirmados] = await Promise.all([
    prisma.pagamento.findMany({
      where: { status: "aguardando" },
      include: { usuario: true },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.usuario.findMany({
      where: { papel: { not: "admin" } },
      include: { assinatura: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.pagamento.findMany({
      where: { status: "confirmado" },
      include: { usuario: true },
      orderBy: { respondidoEm: "desc" },
      take: 10,
    }),
  ]);

  const receitaAtiva = assinantes.filter(
    (assinante) => avaliarAssinatura(assinante.assinatura).status === "ativa",
  ).length;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-semibold text-carvao">
          Pagamentos e assinantes
        </h1>
        <p className="mt-2 text-carvao-suave">
          Confira os Pix recebidos na chave {PLANO.pixChave} e libere o acesso de quem já
          pagou.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { rotulo: "Avisos para conferir", valor: String(aguardando.length) },
          { rotulo: "Assinaturas em dia", valor: String(receitaAtiva) },
          {
            rotulo: "Receita recorrente",
            valor: emReais(receitaAtiva * PLANO.valorCentavos),
          },
        ].map((item) => (
          <div key={item.rotulo} className="cartao py-5">
            <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
              {item.rotulo}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-carvao">
              {item.valor}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Esperando sua conferência
        </h2>

        {aguardando.length === 0 ? (
          <Vazio
            titulo="Nada pendente por aqui"
            texto="Quando alguém avisar que fez o Pix, o aviso aparece nesta lista para você confirmar."
          />
        ) : (
          <ul className="space-y-3">
            {aguardando.map((pagamento) => (
              <li
                key={pagamento.id}
                className="cartao flex flex-wrap items-start justify-between gap-4"
              >
                <div>
                  <p className="font-display text-lg font-semibold text-carvao">
                    {pagamento.usuario.nomeNegocio}
                  </p>
                  <p className="text-sm text-carvao-suave">
                    {pagamento.usuario.nome} · {pagamento.usuario.email}
                    {pagamento.usuario.telefone
                      ? ` · ${telefoneBonito(pagamento.usuario.telefone)}`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm text-carvao">
                    {emReais(pagamento.valorCentavos)} ·{" "}
                    {competenciaPorExtenso(pagamento.competencia)} · avisado em{" "}
                    {dataEHora(pagamento.criadoEm)}
                  </p>
                  {pagamento.observacao ? (
                    <p className="mt-2 rounded-2xl bg-areia/40 px-3 py-2 text-sm text-carvao-suave">
                      {pagamento.observacao}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action={confirmarPagamento}>
                    <input type="hidden" name="id" value={pagamento.id} />
                    <BotaoEnviar>Confirmar e liberar 30 dias</BotaoEnviar>
                  </form>
                  <form action={recusarPagamento}>
                    <input type="hidden" name="id" value={pagamento.id} />
                    <BotaoConfirmar
                      pergunta={`Marcar o Pix de ${pagamento.usuario.nome} como não localizado?`}
                    >
                      Não localizei
                    </BotaoConfirmar>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Assinantes{" "}
          <span className="text-base font-normal text-carvao-suave">
            ({assinantes.length})
          </span>
        </h2>

        {assinantes.length === 0 ? (
          <Vazio
            titulo="Nenhuma conta criada ainda"
            texto="Assim que alguém se cadastrar, a conta aparece aqui com a situação da assinatura."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {assinantes.map((assinante) => {
              const situacao = avaliarAssinatura(assinante.assinatura);
              return (
                <li key={assinante.id} className="cartao">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold text-carvao">
                        {assinante.nomeNegocio}
                      </p>
                      <p className="text-sm text-carvao-suave">
                        {assinante.nome} · {assinante.email}
                      </p>
                    </div>
                    <Etiqueta
                      tom={
                        situacao.status === "ativa"
                          ? "boa"
                          : situacao.status === "expirada"
                            ? "erro"
                            : "atencao"
                      }
                    >
                      {rotuloStatus[situacao.status]}
                    </Etiqueta>
                  </div>

                  <p className="mt-3 text-sm text-carvao-suave">
                    {situacao.liberada ? "Acesso até" : "Venceu em"}{" "}
                    {dataCurta(situacao.validaAte)} · na casa desde{" "}
                    {dataCurta(assinante.criadoEm)}
                  </p>

                  {assinante.assinatura ? (
                    <form action={darCortesia} className="mt-4">
                      <input type="hidden" name="usuarioId" value={assinante.id} />
                      <BotaoEnviar variante="suave">Dar 7 dias de cortesia</BotaoEnviar>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmados.length > 0 ? (
        <section className="cartao">
          <h2 className="font-display text-xl font-semibold text-carvao">
            Últimos Pix confirmados
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {confirmados.map((pagamento) => (
              <li
                key={pagamento.id}
                className="flex flex-wrap justify-between gap-3 border-b border-areia-escura/50 pb-2 last:border-0"
              >
                <span className="text-carvao">
                  {pagamento.usuario.nomeNegocio} ·{" "}
                  {competenciaPorExtenso(pagamento.competencia)}
                </span>
                <span className="text-carvao-suave">
                  {emReais(pagamento.valorCentavos)}
                  {pagamento.respondidoEm
                    ? ` · confirmado em ${dataCurta(pagamento.respondidoEm)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
