import { prisma } from "@/lib/prisma";
import { qrCodeSvg } from "@/lib/qrcode";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { agoraDoPedido } from "@/lib/agora";
import { Aviso, Etiqueta } from "@/componentes/avisos";
import { LinksDeContato } from "@/componentes/contato";
import { canaisDeContato } from "@/lib/contato";
import {
  FAMILIAS,
  NOME_DA_FAMILIA,
  PIX_CHAVE,
  PIX_NOME,
  PLANOS,
  aplicarPagamento,
  economiaDoAnual,
  familiaPorTexto,
  identificadorDoPix,
  mensalDoAnual,
  pixCopiaECola,
  planoPorCodigo,
  planoValendo,
  planosDaFamilia,
  NIVEL_DA_FAMILIA,
  type CodigoPlano,
  type FamiliaDoPlano,
} from "@/lib/assinatura";
import { textosDoPlano } from "@/lib/itens-dos-planos";
import { oQueOPlanoLibera } from "./frase-do-plano";
import { DIAS_PARA_DESISTIR } from "@/lib/leis";
import {
  competenciaPorExtenso,
  dataCurta,
  dataEHora,
  emReais,
} from "@/lib/formato";
import { PagamentoPix, type OpcaoDePlano } from "./escolha";

export const metadata = { title: "Assinatura" };
export const dynamic = "force-dynamic";

const rotuloStatus = {
  teste: "Período de teste",
  demonstracao: "Conhecendo o Bossa",
  ativa: "Assinatura em dia",
  aguardando: "Conferindo seu Pix",
  expirada: "Assinatura vencida",
} as const;

const rotuloPagamento = {
  aguardando: "Conferindo",
  confirmado: "Confirmado",
  recusado: "Não localizado",
  // Aviso gravado duas vezes antes de existir a regra de um aviso por conta.
  repetido: "Aviso repetido",
} as const;

export default async function PaginaAssinatura({
  searchParams,
}: {
  searchParams: Promise<{
    plano?: string;
    assinar?: string;
    vip?: string;
    completo?: string;
    demonstracao?: string;
  }>;
}) {
  const busca = await searchParams;
  /*
    "?plano=pro" ou "?plano=vip": veio de uma função que esse plano libera.
    "completo=1" e "vip=1" são os endereços antigos (do tempo do plano
    Completo, que hoje é o VIP): links velhos continuam funcionando.
  */
  const pediuPlano: FamiliaDoPlano | null =
    familiaPorTexto(busca.plano) ?? (busca.completo || busca.vip ? "vip" : null);
  // "?assinar=pro": escolheu o plano na página de vendas. Abre nele, sem o recado de função bloqueada.
  const escolheuNaVitrine = familiaPorTexto(busca.assinar);
  const planoPedido = pediuPlano ?? escolheuNaVitrine;
  const veioDaDemonstracao = Boolean(busca.demonstracao);
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);
  const agora = agoraDoPedido();

  const pagamentos = await prisma.pagamento.findMany({
    where: { usuarioId: usuario.id },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: 12,
  });

  // Só existe um aviso esperando por conta (o banco garante).
  const pendente = pagamentos.find((pagamento) => pagamento.status === "aguardando") ?? null;
  const planoDoPendente = pendente ? planoPorCodigo(pendente.plano) : null;
  // O último Pix foi marcado como não localizado e nada foi avisado depois.
  const recusado = !pendente && pagamentos[0]?.status === "recusado" ? pagamentos[0] : null;

  /*
    O plano de hoje: o pago e valendo. Quem já pagou e venceu renova pelo
    último plano que pagou. O teste antigo e a demonstração não têm plano.
  */
  const vigente = planoValendo(usuario.assinatura, agora);
  const ultimoPlanoPago = usuario.assinatura?.status === "ativa" ? planoPorCodigo(usuario.assinatura.plano) : null;
  const temContato = canaisDeContato().length > 0;

  /*
    O plano que já vem marcado é o de hoje (ou o do Pix avisado), nunca o
    Normal mensal por padrão: quem tinha o VIP e tocava em "Já fiz o Pix" sem
    olhar avisava o Normal. Sem plano nenhum, quem veio de uma função do Pro ou
    do VIP encontra esse plano marcado; os outros escolhem, sem nada marcado.
  */
  const planoInicial: CodigoPlano | null =
    planoDoPendente?.codigo ??
    ultimoPlanoPago?.codigo ??
    (planoPedido ? planosDaFamilia(planoPedido)[0].codigo : null);

  // Sem PIX_CHAVE configurada o QR Code sairia apontando para lugar nenhum,
  // e o cliente pagaria errado. Melhor avisar do que gerar um código quebrado.
  // Chave ambígua (11 dígitos: CPF ou telefone?) não gera código: conta como sem Pix.
  const pixConfigurado =
    PIX_CHAVE.trim().length > 0 && pixCopiaECola({ chave: PIX_CHAVE, nome: PIX_NOME, valorCentavos: 100 }) !== "";

  /*
    As listas de cada plano saem de itens-dos-planos.ts, a mesma fonte da
    página de vendas: o que se promete lá é o que aparece aqui. A economia do
    anual é calculada dos preços, nunca escrita à mão.
  */
  const economia = (familia: FamiliaDoPlano) => economiaDoAnual(familia);
  const doAnual = (familia: FamiliaDoPlano) => [
    ...(economia(familia) > 0 ? [`Economize ${emReais(economia(familia))} no ano`] : []),
    `Sai por ${emReais(mensalDoAnual(familia))} ao mês, num Pix só`,
    "Preço travado por 12 meses, mesmo se a mensalidade subir",
  ];
  const seloDoAnual = (familia: FamiliaDoPlano) =>
    economia(familia) > 0 ? `Economize ${emReais(economia(familia))}` : null;

  const sobreOPlano = (plano: (typeof PLANOS)[CodigoPlano]) => {
    const anual = plano.dias >= 365;
    return {
      selo: anual ? seloDoAnual(plano.familia) : plano.familia === "vip" ? "Tudo liberado" : null,
      vantagens: anual
        ? [...doAnual(plano.familia), ...textosDoPlano(plano.familia)]
        : textosDoPlano(plano.familia),
    };
  };

  // Sempre do mais barato ao mais completo; o plano pedido já vem marcado (planoInicial).
  const ordem: CodigoPlano[] = FAMILIAS.flatMap((familia) =>
    planosDaFamilia(familia).map((plano) => plano.codigo),
  );

  /** O que este Pix faria se fosse confirmado hoje, pela mesma regra da confirmação do admin. */
  const previsao = (codigo: CodigoPlano) => {
    const plano = PLANOS[codigo];
    const resultado = aplicarPagamento(usuario.assinatura, codigo, agora);
    const ate = dataCurta(resultado.validaAte);
    if (resultado.conversao && vigente) {
      return `Os dias que faltam no ${vigente.nome} viram ${emReais(resultado.conversao.creditoCentavos)} de crédito, que dão mais ${resultado.conversao.diasExtras} dias no ${plano.nome}. Se confirmarmos hoje, vale até ${ate}.`;
    }
    // Plano pago valendo, ou o teste antigo ainda valendo: os dias se somam.
    if (vigente || (usuario.assinatura && usuario.assinatura.validaAte.getTime() > agora.getTime())) {
      return `Os ${plano.dias} dias deste Pix se somam aos que você já tem: vale até ${ate}.`;
    }
    return `Acesso por ${plano.dias} dias a partir da confirmação. Se confirmarmos hoje, vale até ${ate}.`;
  };

  const opcoes: OpcaoDePlano[] = pixConfigurado
    ? await Promise.all(
        ordem.map(async (codigo) => {
          const plano = PLANOS[codigo];
          const copiaECola = pixCopiaECola({
            chave: PIX_CHAVE,
            nome: PIX_NOME,
            valorCentavos: plano.valorCentavos,
            // Um por conta: no extrato, o admin sabe de quem é o Pix.
            identificador: identificadorDoPix(usuario.id),
          });

          return {
            codigo: plano.codigo,
            nome: plano.nome,
            familia: plano.familia,
            periodo: plano.periodo,
            valor: emReais(plano.valorCentavos),
            dias: plano.dias,
            selo: sobreOPlano(plano).selo,
            vantagens: sobreOPlano(plano).vantagens,
            atual: vigente?.codigo === plano.codigo,
            previsao: previsao(plano.codigo),
            copiaECola,
            qrCode: await qrCodeSvg(copiaECola),
          };
        }),
      )
    : [];

  const fraseDoPlano = pediuPlano ? oQueOPlanoLibera(pediuPlano) : "";
  // Quem já tem o plano pedido (ou um maior) nunca vê o convite.
  const mostrarConvite =
    pediuPlano !== null &&
    pediuPlano !== "normal" &&
    (!vigente || NIVEL_DA_FAMILIA[vigente.familia] < NIVEL_DA_FAMILIA[pediuPlano]);

  return (
    <div className="space-y-8">
      {veioDaDemonstracao && situacao.demonstracao ? (
        <div
          role="status"
          className="animar-entrada rounded-2xl border border-terracota/40 bg-terracota/10 px-5 py-4"
        >
          <p className="font-semibold text-carvao">
            Para fazer isso com os seus clientes, escolha um plano.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-carvao-suave">
            Até aqui você viu um estúdio de exemplo. Depois do Pix confirmado, o painel passa a ser
            seu, começando vazio, só com os seus dados.
          </p>
        </div>
      ) : mostrarConvite && pediuPlano ? (
        /* A frase só cita o que está ligado neste servidor. */
        <div className="animar-entrada rounded-2xl border border-terracota/40 bg-terracota/10 px-5 py-4">
          <p className="font-semibold text-carvao">
            Essa parte é do plano {NOME_DA_FAMILIA[pediuPlano]}
          </p>
          {fraseDoPlano ? (
            <p className="mt-1 text-sm leading-relaxed text-carvao-suave">{fraseDoPlano}</p>
          ) : null}
        </div>
      ) : null}

      {recusado ? (
        <Aviso tom="erro">
          <strong className="block font-semibold">Não localizamos o seu Pix</strong>
          O Pix de {emReais(recusado.valorCentavos)} ({planoPorCodigo(recusado.plano).nome}) avisado em{" "}
          {dataEHora(recusado.criadoEm)} não apareceu na nossa conta. Confira no comprovante se o
          valor e o nome de quem recebe estão certos e avise de novo aqui embaixo.
          {temContato ? (
            <>
              {" "}Se o Pix saiu certinho, fale com a gente: <LinksDeContato />.
            </>
          ) : null}
        </Aviso>
      ) : null}

      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
          {situacao.demonstracao ? "Escolha seu plano" : "Sua assinatura"}
        </h1>
        <p className="mt-2 max-w-2xl text-carvao-suave">
          Pagamento por Pix, sem fidelidade e sem multa. Você tem {DIAS_PARA_DESISTIR} dias para
          desistir e receber o dinheiro de volta.
        </p>
      </section>

      {/* Os três planos lado a lado, com o mensal e o anual de cada um. */}
      <section aria-label="Planos" className="grid gap-4 md:grid-cols-3">
        {FAMILIAS.map((familia) => {
          const [mensal, anual] = planosDaFamilia(familia);
          const itens = textosDoPlano(familia);
          const destaque = familia === (planoPedido ?? "pro");
          return (
            <div
              key={familia}
              className={`cartao flex flex-col ${destaque ? "border-terracota ring-2 ring-terracota/20" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-carvao">
                  {NOME_DA_FAMILIA[familia]}
                </h2>
                {vigente?.familia === familia ? (
                  <Etiqueta tom="boa">Seu plano</Etiqueta>
                ) : familia === "vip" ? (
                  <Etiqueta tom="espera">Tudo liberado</Etiqueta>
                ) : destaque ? (
                  <Etiqueta tom="espera">Recomendado</Etiqueta>
                ) : null}
              </div>
              <p className="mt-3">
                <span className="font-display text-3xl font-semibold tabular-nums text-carvao">
                  {emReais(mensal.valorCentavos)}
                </span>{" "}
                <span className="text-sm text-carvao-suave">{mensal.periodo}</span>
              </p>
              <p className="mt-1 text-sm text-carvao-suave">
                ou {emReais(anual.valorCentavos)} {anual.periodo}
                {economia(familia) > 0 ? (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="font-semibold text-terracota">
                      economize {emReais(economia(familia))}
                    </strong>
                  </>
                ) : null}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-carvao-suave">
                {itens.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="cartao">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-carvao">Como está hoje</h2>
            <Etiqueta
              tom={
                situacao.status === "ativa" && !situacao.venceLogo
                  ? "boa"
                  : situacao.status === "expirada"
                    ? "erro"
                    : "atencao"
              }
            >
              {situacao.venceLogo ? "Perto de vencer" : rotuloStatus[situacao.status]}
            </Etiqueta>
          </div>

          <p className="mt-4 leading-relaxed text-carvao-suave">
            {situacao.demonstracao && situacao.status === "aguardando"
              ? "Recebemos o aviso do seu Pix. Assim que confirmarmos, o painel passa a mostrar os seus dados."
              : situacao.recado}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            {ultimoPlanoPago ? (
              <div className="flex justify-between gap-4">
                <dt className="text-carvao-suave">{vigente ? "Seu plano" : "Último plano"}</dt>
                <dd className="text-right font-semibold text-carvao">{ultimoPlanoPago.nome}</dd>
              </div>
            ) : null}
            {situacao.demonstracao ? null : (
              <div className="flex justify-between gap-4">
                <dt className="text-carvao-suave">
                  {situacao.liberada ? "Vale até" : "Venceu em"}
                </dt>
                <dd className="text-right font-semibold text-carvao">{dataCurta(situacao.validaAte)}</dd>
              </div>
            )}
            {pendente && planoDoPendente ? (
              <div className="flex justify-between gap-4">
                <dt className="text-carvao-suave">Pix avisado</dt>
                <dd className="text-right font-semibold text-carvao">
                  {planoDoPendente.nome} · {emReais(pendente.valorCentavos)}
                </dd>
              </div>
            ) : null}
          </dl>

          {situacao.status === "expirada" ? (
            <div className="mt-5">
              <Aviso tom="atencao">
                Seus dados continuam guardados, viu? É só fazer o Pix que tudo volta
                exatamente como você deixou.
              </Aviso>
            </div>
          ) : null}

          <p className="mt-6 border-t border-areia-escura/60 pt-4 text-xs leading-relaxed text-carvao-suave">
            Garantia de {DIAS_PARA_DESISTIR} dias: se desistir nesse prazo, devolvemos o seu dinheiro
            (direito de arrependimento do Código de Defesa do Consumidor).
            {temContato ? (
              <>
                {" "}Para pedir, fale com a gente: <LinksDeContato />.
              </>
            ) : null}
          </p>
        </div>

        <div className="cartao">
          <h2 className="font-display text-xl font-semibold text-carvao">
            Pagar com Pix
          </h2>
          <p className="mt-1 text-sm text-carvao-suave">
            Escolha o plano, aponte a câmera do banco para o QR Code ou copie o código e
            cole no Pix Copia e Cola do seu aplicativo.
          </p>

          {pixConfigurado ? (
            <div className="mt-5">
              <PagamentoPix
                opcoes={opcoes}
                pixNome={PIX_NOME}
                planoInicial={planoInicial}
                planoAvisado={planoDoPendente?.codigo ?? null}
                planoAtual={vigente ? { nome: vigente.nome, familia: vigente.familia } : null}
                contato={temContato ? <LinksDeContato /> : null}
              />
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-areia-escura bg-creme px-4 py-3 text-sm text-carvao-suave">
              O pagamento por Pix está indisponível neste momento. Tente de novo mais tarde
              {temContato ? (
                <>
                  {" "}ou fale com a gente: <LinksDeContato />
                </>
              ) : null}
              .
            </p>
          )}
        </div>
      </section>

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Histórico de pagamentos
        </h2>

        {pagamentos.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
            Nenhum pagamento por aqui ainda. Quando você avisar o primeiro Pix, ele aparece
            nesta lista.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {pagamentos.map((pagamento) => (
              <li
                key={pagamento.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-areia-escura/70 bg-creme px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-carvao">
                    {planoPorCodigo(pagamento.plano).nome} · {emReais(pagamento.valorCentavos)}
                  </p>
                  <p className="text-xs text-carvao-suave">
                    {competenciaPorExtenso(pagamento.competencia)} · avisado em {dataEHora(pagamento.criadoEm)}
                    {pagamento.observacao ? ` · "${pagamento.observacao}"` : ""}
                  </p>
                </div>
                <Etiqueta
                  tom={
                    pagamento.status === "confirmado"
                      ? "boa"
                      : pagamento.status === "recusado"
                        ? "erro"
                        : pagamento.status === "repetido"
                          ? "calma"
                          : "atencao"
                  }
                >
                  {rotuloPagamento[pagamento.status as keyof typeof rotuloPagamento] ??
                    pagamento.status}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
