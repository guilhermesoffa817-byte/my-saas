import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { BotaoTema } from "@/componentes/tema";
import { CenaAntes, CenaDepois } from "@/componentes/cenas";
import {
  PLANOS,
  DIAS_DE_TESTE,
  MESES_DE_BRINDE,
  ECONOMIA_ANUAL_CENTAVOS,
  ECONOMIA_VIP_ANUAL_CENTAVOS,
} from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import {
  DESCRICAO_CURTA,
  ENDERECO_DO_SITE,
  FRASE_DA_MARCA,
  NOME_DO_PRODUTO,
  SEGMENTOS,
} from "@/lib/site";

const problemas = [
  {
    dor: "Marcou duas no mesmo horário",
    solucao: "O sistema avisa na hora em que os horários batem.",
  },
  {
    dor: "Esqueceu o que o cliente prefere",
    solucao: "Cada cliente tem ficha com alergia, preferência e aniversário.",
  },
  {
    dor: "Tem gente devendo e você não lembra quem",
    solucao: "O Bossa mostra quem cobrar hoje e abre o WhatsApp com a mensagem pronta.",
  },
  {
    dor: "Não sabe quanto ganhou no mês",
    solucao: "O faturamento aparece somado, sem planilha nenhuma.",
  },
];

/**
 * Os dados estruturados que o Google lê para entender que isto é um programa
 * por assinatura, de que ramo e por quanto. É o que permite o resultado da
 * busca aparecer com o preço em vez de só o endereço. Os valores saem dos
 * planos de verdade, para nunca desencontrarem do que a página mostra.
 */
const dadosParaOGoogle = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: NOME_DO_PRODUTO,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Sistema de agendamento",
  operatingSystem: "Web",
  url: ENDERECO_DO_SITE,
  description: DESCRICAO_CURTA,
  slogan: FRASE_DA_MARCA,
  inLanguage: "pt-BR",
  audience: {
    "@type": "BusinessAudience",
    audienceType: SEGMENTOS.join(", "),
  },
  offers: [PLANOS.mensal, PLANOS.vip_mensal].map((plano) => ({
    "@type": "Offer",
    name: plano.nome,
    price: (plano.valorCentavos / 100).toFixed(2),
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: `${ENDERECO_DO_SITE}/criar-conta`,
  })),
};

export default function PaginaInicial() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosParaOGoogle) }}
      />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Marca />
        <nav className="flex items-center gap-2 sm:gap-3">
          <BotaoTema />
          <Link
            href="/entrar"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-carvao-suave transition hover:text-terracota"
          >
            Entrar
          </Link>
          <Link href="/criar-conta" className="botao">
            Começar
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-8 pb-14 text-center md:pt-14">
          <span className="etiqueta border border-areia-escura bg-areia/60 text-carvao-suave">
            Para qualquer estúdio que marca hora
          </span>

          <h1 className="animar-entrada mx-auto mt-5 max-w-3xl font-display text-4xl leading-[1.08] font-semibold text-balance text-carvao md:text-6xl">
            Pare de perder horário,
            <br />
            <span className="text-terracota">cliente e dinheiro.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-carvao-suave">
            Sua agenda, seus clientes e seu faturamento num lugar só. Abre no
            celular, não instala nada.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/criar-conta" className="botao px-8 py-3.5 text-base">
              Testar {DIAS_DE_TESTE} dias grátis
            </Link>
            <Link href="#planos" className="botao-suave px-6 py-3 text-base">
              Ver preço
            </Link>
          </div>

          <p className="mt-3 text-sm text-carvao-suave">
            Sem cartão. Cancele quando quiser.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="animar-entrada">
              <p className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-carvao-suave">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-areia text-xs font-bold">
                  1
                </span>
                Hoje
              </p>
              <CenaAntes />
              <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
                Caderno, WhatsApp e memória. Um horário escapa e o cliente não volta.
              </p>
            </div>

            <div className="animar-entrada" style={{ animationDelay: "120ms" }}>
              <p className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-terracota">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracota text-xs font-bold text-acento-texto">
                  2
                </span>
                Com o {NOME_DO_PRODUTO}
              </p>
              <CenaDepois />
              <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
                A semana inteira numa tela, e o dinheiro do mês somado sozinho.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-areia-escura/60 bg-superficie/70">
          <div className="mx-auto max-w-6xl px-5 pt-14">
            <h2 className="font-display text-2xl font-semibold text-carvao">
              O que o sistema de agendamento resolve
            </h2>
          </div>
          <div className="mx-auto grid max-w-6xl gap-6 px-5 pt-8 pb-10 sm:grid-cols-2 lg:grid-cols-4">
            {problemas.map((item, posicao) => (
              <div
                key={item.dor}
                className="animar-entrada"
                style={{ animationDelay: `${posicao * 90}ms` }}
              >
                <p className="font-display text-lg font-semibold text-carvao">
                  {item.dor}
                </p>
                <p className="mt-1.5 leading-relaxed text-carvao-suave">{item.solucao}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto max-w-6xl px-5 pb-14">
            <p className="text-sm leading-relaxed text-carvao-suave">
              Serve para estúdio de {SEGMENTOS.join(", ")} e qualquer outro
              negócio que marque hora com cliente.
            </p>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16">
          <h2 className="text-center font-display text-3xl font-semibold text-carvao">
            Dois planos, sem fidelidade
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[
              {
                nome: "Essencial",
                mensal: PLANOS.mensal.valorCentavos,
                anual: PLANOS.anual.valorCentavos,
                economia: ECONOMIA_ANUAL_CENTAVOS,
                destaque: false,
                itens: [
                  "Agenda e clientes sem limite",
                  "Ficha com CPF, endereço e observações",
                  "Cobrança pelo WhatsApp, com código Pix pronto",
                  "Faturamento do mês somado sozinho",
                ],
              },
              {
                nome: "VIP",
                mensal: PLANOS.vip_mensal.valorCentavos,
                anual: PLANOS.vip_anual.valorCentavos,
                economia: ECONOMIA_VIP_ANUAL_CENTAVOS,
                destaque: true,
                itens: [
                  "Tudo do Essencial",
                  "Lembretes de quem cobrar, pelas datas",
                  "Contas a pagar e prazos de contrato, com repetição mensal",
                  "Contrato e conta lidos para você conferir",
                  "Imposto estimado e gráfico dos dias que mais rendem",
                ],
              },
            ].map((plano) => (
              <div
                key={plano.nome}
                className={`cartao animar-entrada ${
                  plano.destaque ? "border-terracota ring-1 ring-terracota/25" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-semibold text-carvao">
                    {plano.nome}
                  </h3>
                  {plano.destaque ? (
                    <span className="etiqueta bg-terracota text-acento-texto">
                      Mais completo
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 flex items-end gap-2">
                  <span className="font-display text-4xl font-semibold text-terracota tabular-nums">
                    {emReais(plano.mensal)}
                  </span>
                  <span className="pb-1.5 text-sm text-carvao-suave">por mês</span>
                </p>

                <p className="mt-1 text-sm text-carvao-suave">
                  Ou {emReais(plano.anual)} no ano, com {MESES_DE_BRINDE} meses de
                  brinde.
                </p>

                <ul className="mt-5 space-y-2 text-sm text-carvao-suave">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/criar-conta"
                  className={`mt-6 w-full ${plano.destaque ? "botao" : "botao-suave"}`}
                >
                  Testar {DIAS_DE_TESTE} dias grátis
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-carvao-suave">
            Pagamento por Pix. Sem cartão para testar, sem multa para sair.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-xl2 bg-inverso px-8 py-14 text-center">
            <h2 className="font-display text-3xl font-semibold text-inverso-texto md:text-4xl">
              Comece agora, leva um minuto
            </h2>
            <p className="mx-auto mt-3 max-w-md text-inverso-texto/75">
              {DIAS_DE_TESTE} dias para usar de verdade. Se não ajudar, é só não
              assinar.
            </p>
            <Link
              href="/criar-conta"
              className="mt-7 inline-flex rounded-xl bg-superficie px-8 py-3.5 text-base font-semibold text-carvao transition hover:bg-areia"
            >
              Criar minha conta
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-areia-escura/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-carvao-suave">
          <Marca />
          <p>{FRASE_DA_MARCA.charAt(0).toUpperCase() + FRASE_DA_MARCA.slice(1)}.</p>
        </div>
      </footer>
    </div>
  );
}
