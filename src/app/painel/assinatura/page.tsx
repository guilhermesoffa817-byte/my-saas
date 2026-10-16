import { prisma } from "@/lib/prisma";
import { qrCodeSvg } from "@/lib/qrcode";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { Aviso, Etiqueta } from "@/componentes/avisos";
import {
  MESES_DE_BRINDE,
  PIX_CHAVE,
  PIX_NOME,
  PLANOS,
  ECONOMIA_ANUAL_CENTAVOS,
  ECONOMIA_VIP_ANUAL_CENTAVOS,
  pixCopiaECola,
  type CodigoPlano,
} from "@/lib/assinatura";
import { textosDoPlano } from "@/lib/itens-dos-planos";
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
  ativa: "Assinatura em dia",
  aguardando: "Conferindo seu Pix",
  expirada: "Assinatura vencida",
} as const;

const rotuloPagamento = {
  aguardando: "Conferindo",
  confirmado: "Confirmado",
  recusado: "Não localizado",
} as const;

export default async function PaginaAssinatura({
  searchParams,
}: {
  searchParams: Promise<{ vip?: string }>;
}) {
  const { vip } = await searchParams;
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);

  const pagamentos = await prisma.pagamento.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 12,
  });

  const jaAvisou = pagamentos.some((pagamento) => pagamento.status === "aguardando");

  // Sem PIX_CHAVE configurada o QR Code sairia apontando para lugar nenhum,
  // e o cliente pagaria errado. Melhor avisar do que gerar um código quebrado.
  const pixConfigurado = PIX_CHAVE.trim().length > 0;

  // As listas de cada plano saem de itens-dos-planos.ts, a mesma fonte da
  // página de vendas: o que se promete lá é o que aparece aqui.
  const doAnual = (economia: number) => [
    `Economia de ${emReais(economia)} no ano`,
    "Preço travado por 12 meses, mesmo se a mensalidade subir",
    "Um Pix só no ano inteiro, sem precisar lembrar todo mês",
  ];
  const brinde = `${MESES_DE_BRINDE} meses de brinde`;

  const sobreOPlano: Record<CodigoPlano, { selo: string | null; vantagens: string[] }> = {
    mensal: { selo: null, vantagens: textosDoPlano("essencial") },
    anual: {
      selo: brinde,
      vantagens: [...doAnual(ECONOMIA_ANUAL_CENTAVOS), ...textosDoPlano("essencial")],
    },
    vip_mensal: { selo: "Mais completo", vantagens: textosDoPlano("vip") },
    vip_anual: {
      selo: brinde,
      vantagens: [...doAnual(ECONOMIA_VIP_ANUAL_CENTAVOS), ...textosDoPlano("vip")],
    },
  };

  const opcoes: OpcaoDePlano[] = pixConfigurado
    ? await Promise.all(
        Object.values(PLANOS).map(async (plano) => {
          const copiaECola = pixCopiaECola({
            chave: PIX_CHAVE,
            nome: PIX_NOME,
            valorCentavos: plano.valorCentavos,
            identificador: plano.codigo === "anual" ? "AGENDAANUAL" : "AGENDA",
          });

          return {
            codigo: plano.codigo,
            nome: plano.nome,
            periodo: plano.periodo,
            valor: emReais(plano.valorCentavos),
            dias: plano.dias,
            selo: sobreOPlano[plano.codigo].selo,
            vantagens: sobreOPlano[plano.codigo].vantagens,
            copiaECola,
            qrCode: await qrCodeSvg(copiaECola),
          };
        }),
      )
    : [];

  return (
    <div className="space-y-8">
      {vip ? (
        <div className="animar-entrada rounded-2xl border border-terracota/40 bg-terracota/10 px-5 py-4">
          <p className="font-semibold text-carvao">Essa parte é do plano VIP</p>
          <p className="mt-1 text-sm leading-relaxed text-carvao-suave">
            O VIP libera finanças, custos, relatório para o contador, contas a pagar,
            leitura de documentos, equipe e o assistente. Para liberar, escolha um dos
            planos VIP abaixo.
          </p>
        </div>
      ) : null}

      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">Sua assinatura</h1>
        <p className="mt-2 max-w-2xl text-carvao-suave">
          A partir de {emReais(PLANOS.mensal.valorCentavos)} ao mês. O plano VIP acrescenta
          finanças, contas, documentos, equipe e o assistente, e os planos anuais dão{" "}
          {MESES_DE_BRINDE} meses de brinde. Pagamento por Pix, sem fidelidade e sem multa.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="cartao">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-carvao">Como está hoje</h2>
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

          <p className="mt-4 leading-relaxed text-carvao-suave">{situacao.recado}</p>

          <dl className="mt-6 space-y-3 text-sm">
            {Object.values(PLANOS).map((plano) => (
              <div
                key={plano.codigo}
                className="flex justify-between gap-4 border-b border-areia-escura/60 pb-3"
              >
                <dt className="text-carvao-suave">{plano.nome}</dt>
                <dd className="font-semibold tabular-nums text-carvao">
                  {emReais(plano.valorCentavos)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-carvao-suave">
                {situacao.liberada ? "Vale até" : "Venceu em"}
              </dt>
              <dd className="font-semibold text-carvao">{dataCurta(situacao.validaAte)}</dd>
            </div>
          </dl>

          {situacao.status === "expirada" ? (
            <div className="mt-5">
              <Aviso tom="atencao">
                Seus dados continuam guardados, viu? É só fazer o Pix que tudo volta
                exatamente como você deixou.
              </Aviso>
            </div>
          ) : null}
        </div>

        <div className="cartao">
          <h2 className="font-display text-xl font-semibold text-carvao">
            Pagar com Pix
          </h2>
          <p className="mt-1 text-sm text-carvao-suave">
            Aponte a câmera do banco para o QR Code, ou copie o código e cole no
            Pix Copia e Cola do seu aplicativo.
          </p>

          {pixConfigurado ? (
            <div className="mt-5">
              <PagamentoPix opcoes={opcoes} pixNome={PIX_NOME} jaAvisou={jaAvisou} />
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-areia-escura bg-creme px-4 py-3 text-sm text-carvao-suave">
              A chave Pix ainda não foi configurada, então o QR Code não pode ser
              gerado. Defina <code>PIX_CHAVE</code> e <code>PIX_NOME</code> nas
              variáveis de ambiente do site.
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
                    {competenciaPorExtenso(pagamento.competencia)} ·{" "}
                    {emReais(pagamento.valorCentavos)}
                  </p>
                  <p className="text-xs text-carvao-suave">
                    Avisado em {dataEHora(pagamento.criadoEm)}
                    {pagamento.observacao ? ` · "${pagamento.observacao}"` : ""}
                  </p>
                </div>
                <Etiqueta
                  tom={
                    pagamento.status === "confirmado"
                      ? "boa"
                      : pagamento.status === "recusado"
                        ? "erro"
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
