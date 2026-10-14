import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/guardas";
import { Etiqueta, Vazio } from "@/componentes/avisos";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/botoes";
import {
  avaliarAssinatura,
  DIAS_DE_TESTE,
  pagandoEmDia,
  planoPorCodigo,
  receitaRecorrente,
} from "@/lib/assinatura";
import {
  competenciaPorExtenso,
  dataCurta,
  dataEHora,
  emReais,
  telefoneBonito,
} from "@/lib/formato";
import { confirmarPagamento, darCortesia, recusarPagamento } from "./acoes";
import { Indicacoes, type Parceiro } from "./indicacoes";
import { Senhas, type ContaParaSenha } from "./senhas";

export const metadata = { title: "Pagamentos" };
export const dynamic = "force-dynamic";

const rotuloStatus = {
  teste: "Em teste",
  ativa: "Em dia",
  aguardando: "Conferindo",
  expirada: "Vencida",
} as const;

export default async function PaginaAdmin() {
  await exigirAdmin();
  const agora = new Date();

  const [aguardando, assinantes, confirmados, pedidosDeSenha] = await Promise.all([
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
    /* Quem pediu senha nova e ainda não recebeu link. */
    prisma.pedidoDeSenha.findMany({
      where: { usadoEm: null, entregueEm: null, expiraEm: { gt: agora } },
      orderBy: { criadoEm: "asc" },
      select: { usuarioId: true, criadoEm: true },
    }),
  ]);

  const pediuSenhaEm = new Map(
    pedidosDeSenha.map((pedido) => [pedido.usuarioId, dataEHora(pedido.criadoEm)]),
  );

  const contasParaSenha: ContaParaSenha[] = assinantes.map((conta) => ({
    id: conta.id,
    nome: conta.nome,
    email: conta.email,
    telefone: conta.telefone,
    nomeNegocio: conta.nomeNegocio,
    pediuEm: pediuSenhaEm.get(conta.id) ?? null,
  }));

  // Quem está esperando vem primeiro.
  contasParaSenha.sort((a, b) => Number(Boolean(b.pediuEm)) - Number(Boolean(a.pediuEm)));

  const emDia = assinantes.filter((assinante) =>
    pagandoEmDia(assinante.assinatura, agora),
  ).length;

  // Cada assinatura entra pelo valor mensal do plano dela: VIP pelo preço do
  // VIP, anual pelo preço do ano dividido por doze.
  const recorrente = receitaRecorrente(
    assinantes.map((assinante) => assinante.assinatura),
    agora,
  );

  // Parceiros são as contas que têm um código de indicação criado.
  const comCodigo = await prisma.usuario.findMany({
    where: { codigoIndicacao: { not: null } },
    select: { nome: true, codigoIndicacao: true },
    orderBy: { nome: "asc" },
  });

  const indicadas = await prisma.usuario.findMany({
    where: { indicadoPor: { not: null } },
    select: {
      nome: true,
      nomeNegocio: true,
      criadoEm: true,
      indicadoPor: true,
      assinatura: true,
      pagamentos: {
        where: { status: "confirmado" },
        select: { valorCentavos: true },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  const parceiros: Parceiro[] = comCodigo.map((parceiro) => ({
    nome: parceiro.nome,
    codigo: parceiro.codigoIndicacao as string,
    contas: indicadas
      .filter((conta) => conta.indicadoPor === parceiro.codigoIndicacao)
      .map((conta) => ({
        nome: conta.nome,
        nomeNegocio: conta.nomeNegocio,
        criadoEm: conta.criadoEm,
        situacao: avaliarAssinatura(conta.assinatura).status,
        totalPagoCentavos: conta.pagamentos.reduce(
          (soma, pagamento) => soma + pagamento.valorCentavos,
          0,
        ),
      })),
  }));

  const enderecoBase = process.env.ENDERECO_DO_SITE ?? "https://agendaonlinecontabilidade.netlify.app";
  const percentualComissao = Number(process.env.COMISSAO_PERCENTUAL ?? 25);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
          Pagamentos e assinantes
        </h1>
        <p className="mt-2 text-carvao-suave">
          Confira os Pix recebidos na sua chave e libere o acesso de quem já
          pagou.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { rotulo: "Avisos para conferir", valor: String(aguardando.length) },
          { rotulo: "Assinaturas em dia", valor: String(emDia) },
          {
            rotulo: "Receita recorrente",
            valor: emReais(recorrente),
            detalhe: "por mês, com os anuais divididos por 12",
          },
        ].map((item) => (
          <div key={item.rotulo} className="cartao py-5">
            <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
              {item.rotulo}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold whitespace-nowrap text-carvao tabular-nums">
              {item.valor}
            </p>
            {item.detalhe ? (
              <p className="mt-1 text-xs text-carvao-suave">{item.detalhe}</p>
            ) : null}
          </div>
        ))}
      </section>

      <Indicacoes
        parceiros={parceiros}
        enderecoBase={enderecoBase}
        percentual={percentualComissao}
      />

      <Senhas contas={contasParaSenha} enderecoDoSite={enderecoBase} />

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
            {aguardando.map((pagamento) => {
              const plano = planoPorCodigo(pagamento.plano);

              return (
                <li
                  key={pagamento.id}
                  className="cartao flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold break-words text-carvao">
                      {pagamento.usuario.nomeNegocio}
                    </p>
                    <p className="text-sm break-words text-carvao-suave">
                      {pagamento.usuario.nome} · {pagamento.usuario.email}
                      {pagamento.usuario.telefone ? (
                        <>
                          {" · "}
                          <span className="whitespace-nowrap">
                            {telefoneBonito(pagamento.usuario.telefone)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm text-carvao">
                      <span className="whitespace-nowrap">{emReais(pagamento.valorCentavos)}</span>{" "}
                      · <strong>{plano.nome}</strong> ({plano.dias} dias) ·{" "}
                      {competenciaPorExtenso(pagamento.competencia)} · avisado em{" "}
                      {dataEHora(pagamento.criadoEm)}
                    </p>
                    {pagamento.observacao ? (
                      <p className="mt-2 rounded-2xl bg-areia/40 px-3 py-2 text-sm break-words text-carvao-suave">
                        {pagamento.observacao}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={confirmarPagamento}>
                      <input type="hidden" name="id" value={pagamento.id} />
                      {/* O botão diz quantos dias libera: o anual vale um ano, não trinta dias. */}
                      <BotaoEnviar>Confirmar e liberar {plano.dias} dias</BotaoEnviar>
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
              );
            })}
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
                // `min-w-0`: item de grade cresce até caber a palavra mais longa,
                // e um e-mail comprido empurrava a tela inteira para o lado.
                <li key={assinante.id} className="cartao min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold break-words text-carvao">
                        {assinante.nomeNegocio}
                      </p>
                      <p className="text-sm break-words text-carvao-suave">
                        {assinante.nome} · {assinante.email}
                        {assinante.telefone ? (
                          <>
                            {" · "}
                            <span className="whitespace-nowrap">
                              {telefoneBonito(assinante.telefone)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="shrink-0">
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
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-carvao-suave">
                    {assinante.assinatura && assinante.assinatura.status !== "teste"
                      ? `${planoPorCodigo(assinante.assinatura.plano).nome} · `
                      : ""}
                    {situacao.liberada ? "Acesso até" : "Venceu em"}{" "}
                    {dataCurta(situacao.validaAte)} · na casa desde{" "}
                    {dataCurta(assinante.criadoEm)}
                  </p>

                  {assinante.assinatura ? (
                    <form action={darCortesia} className="mt-4">
                      <input type="hidden" name="usuarioId" value={assinante.id} />
                      <BotaoEnviar variante="suave">Dar {DIAS_DE_TESTE} dias de cortesia</BotaoEnviar>
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
                  {emReais(pagamento.valorCentavos)} · {planoPorCodigo(pagamento.plano).nome}
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
