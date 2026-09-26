import Link from "next/link";
import { Marca } from "@/componentes/marca";
import {
  PLANOS,
  DIAS_DE_TESTE,
  MESES_DE_BRINDE,
  ECONOMIA_ANUAL_CENTAVOS,
  ECONOMIA_VIP_ANUAL_CENTAVOS,
} from "@/lib/assinatura";
import { BotaoTema } from "@/componentes/tema";
import { emReais } from "@/lib/formato";

const recursos = [
  {
    titulo: "Agenda que cabe na sua rotina",
    texto:
      "Marque um horário em segundos, veja a semana inteira de uma olhada e acompanhe quem já confirmou.",
  },
  {
    titulo: "A ficha de cada cliente",
    texto:
      "Telefone, CPF, endereço, aniversário, alergias e preferências. Tudo guardado com cuidado, num lugar só.",
  },
  {
    titulo: "Seus serviços e preços",
    texto:
      "Cadastre limpeza de pele, design de sobrancelha ou massagem com preço e duração. Na hora de agendar, já vem tudo preenchido.",
  },
  {
    titulo: "Suas contas em ordem",
    texto:
      "O painel soma os atendimentos concluídos e mostra o faturamento do mês. No plano VIP, você acompanha também as despesas e o imposto estimado.",
  },
];

const passos = [
  {
    numero: "1",
    titulo: "Crie sua conta",
    texto: `Leva menos de um minuto e você ganha ${DIAS_DE_TESTE} dias para experimentar sem pagar nada.`,
  },
  {
    numero: "2",
    titulo: "Traga seu estúdio",
    texto:
      "Cadastre seus serviços e suas clientes. Se precisar de ajuda em qualquer etapa, é só nos chamar.",
  },
  {
    numero: "3",
    titulo: "Assine quando fizer sentido",
    texto: `A partir de ${emReais(PLANOS.mensal.valorCentavos)} por mês, pagos por Pix. Sem fidelidade e sem letra miúda.`,
  },
];

const perguntas = [
  {
    pergunta: "Preciso assinar contrato ou ficar preso por algum tempo?",
    resposta:
      "Não. A assinatura é mês a mês e você cancela quando quiser. Se em algum mês não puder pagar, basta não fazer o Pix: seus dados continuam guardados, esperando a sua volta.",
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta: `No painel você escolhe mensal ou anual, faz o Pix pelo QR Code que aparece lá e avisa com um clique. Assim que conferirmos, seu acesso é liberado.`,
  },
  {
    pergunta: "Funciona no celular?",
    resposta:
      "Funciona, sim. O sistema abre no navegador do celular, do tablet ou do computador — o que estiver mais perto de você na hora do atendimento.",
  },
  {
    pergunta: "E se eu tiver dúvida no meio do caminho?",
    resposta:
      "Você fala com uma pessoa de verdade, não com um robô de respostas prontas. Estamos aqui para ajudar em qualquer etapa.",
  },
];

export default function PaginaInicial() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Marca />
        <nav className="flex items-center gap-3">
          <BotaoTema />
          <Link
            href="/entrar"
            className="rounded-full px-4 py-2 text-sm font-semibold text-carvao-suave transition hover:text-terracota"
          >
            Entrar
          </Link>
          <Link href="/criar-conta" className="botao">
            Começar agora
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-20 md:pt-16">
          <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="etiqueta border border-areia-escura bg-areia/60 text-carvao-suave">
                Feito para estúdios de estética
              </span>
              <h1 className="mt-5 font-display text-4xl leading-[1.1] font-semibold text-carvao md:text-6xl">
                Cuide das suas clientes.
                <br />
                <span className="text-terracota">A papelada fica com a gente.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-carvao-suave">
                Agenda, ficha das clientes, serviços e faturamento reunidos num lugar só.
                Simples como o seu dia exige, completo como o seu trabalho merece — sem
                planilha perdida nem caderno que some bem na hora.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/criar-conta" className="botao px-8 py-3.5 text-base">
                  Quero testar {DIAS_DE_TESTE} dias grátis
                </Link>
                <Link href="#plano" className="botao-suave px-6 py-3 text-base">
                  Ver o preço
                </Link>
              </div>
              <p className="mt-4 text-sm text-carvao-suave">
                Não pedimos cartão de crédito para começar.
              </p>
            </div>

            <div className="relative">
              <div className="cartao rounded-xl2 p-7">
                <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                  Hoje no estúdio
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    { hora: "09:00", cliente: "Marina Alves", servico: "Limpeza de pele" },
                    { hora: "11:30", cliente: "Bianca Rocha", servico: "Design de sobrancelha" },
                    { hora: "14:00", cliente: "Tereza Lima", servico: "Massagem relaxante" },
                  ].map((item) => (
                    <li
                      key={item.hora}
                      className="flex items-center gap-4 rounded-2xl border border-areia-escura/70 bg-creme px-4 py-3"
                    >
                      <span className="font-display text-lg font-semibold text-terracota">
                        {item.hora}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-carvao">
                          {item.cliente}
                        </span>
                        <span className="block text-xs text-carvao-suave">{item.servico}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl bg-areia/60 px-4 py-3 text-sm text-carvao-suave">
                  Três atendimentos hoje. Vai dar tudo certo.
                </div>
              </div>
              <div
                className="absolute -top-6 -right-4 -z-10 h-32 w-32 rounded-full bg-rose/50 blur-2xl"
                aria-hidden
              />
            </div>
          </div>
        </section>

        <section className="border-y border-areia-escura/60 bg-superficie/70">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-semibold text-carvao md:text-4xl">
              Tudo o que você anota em três lugares diferentes, aqui num só
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {recursos.map((recurso) => (
                <div key={recurso.titulo} className="cartao">
                  <h3 className="font-display text-xl font-semibold text-carvao">
                    {recurso.titulo}
                  </h3>
                  <p className="mt-2 leading-relaxed text-carvao-suave">{recurso.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl font-semibold text-carvao md:text-4xl">
            Como começa
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {passos.map((passo) => (
              <div key={passo.numero} className="cartao">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-areia font-display text-lg font-semibold text-terracota">
                  {passo.numero}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-carvao">
                  {passo.titulo}
                </h3>
                <p className="mt-2 leading-relaxed text-carvao-suave">{passo.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="plano" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-16">
          <div className="max-w-2xl">
            <span className="etiqueta border border-areia-escura bg-areia/60 text-carvao-suave">
              Dois planos, sem letra miúda
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-carvao md:text-4xl">
              Escolha o que combina com o seu momento
            </h2>
            <p className="mt-3 leading-relaxed text-carvao-suave">
              Comece pelo Essencial para organizar a agenda. Quando quiser enxergar o
              dinheiro com a mesma clareza, o VIP abre a parte financeira. Você troca de
              plano quando quiser, sem multa.
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {[
              {
                etiqueta: "Para começar com o pé direito",
                nome: "Essencial",
                mensal: PLANOS.mensal.valorCentavos,
                anual: PLANOS.anual.valorCentavos,
                economia: ECONOMIA_ANUAL_CENTAVOS,
                destaque: false,
                recursos: [
                  "Agenda completa, quantos atendimentos você quiser",
                  "Clientes e serviços sem limite",
                  "Ficha com CPF, endereço e observações",
                  "Faturamento do mês calculado sozinho",
                  "Atendimento com gente de verdade",
                ],
              },
              {
                etiqueta: "Para quem quer enxergar o lucro",
                nome: "VIP",
                mensal: PLANOS.vip_mensal.valorCentavos,
                anual: PLANOS.vip_anual.valorCentavos,
                economia: ECONOMIA_VIP_ANUAL_CENTAVOS,
                destaque: true,
                recursos: [
                  "Tudo o que o Essencial oferece",
                  "Controle financeiro: o que entrou e o que saiu",
                  "Imposto estimado calculado todo mês",
                  "Gráfico dos dias da semana que mais rendem",
                  "Resumo pronto para conversar com a contadora",
                ],
              },
            ].map((plano) => (
              <div
                key={plano.nome}
                className={`animar-entrada rounded-xl2 border p-8 md:p-10 ${
                  plano.destaque
                    ? "border-terracota bg-superficie shadow-[0_24px_70px_-44px_rgba(14,31,23,0.65)] ring-1 ring-terracota/25"
                    : "border-areia-escura/70 bg-superficie"
                }`}
              >
                <span
                  className={`etiqueta ${
                    plano.destaque
                      ? "bg-terracota text-acento-texto"
                      : "border border-areia-escura bg-areia/60 text-carvao-suave"
                  }`}
                >
                  {plano.etiqueta}
                </span>

                <h3 className="mt-4 font-display text-2xl font-semibold text-carvao">
                  {plano.nome}
                </h3>

                <p className="mt-3 flex items-end gap-2">
                  <span className="font-display text-5xl font-semibold text-terracota tabular-nums">
                    {emReais(plano.mensal)}
                  </span>
                  <span className="pb-2 text-carvao-suave">por mês</span>
                </p>

                <p className="mt-2 text-sm text-carvao-suave">
                  Ou <strong className="text-carvao">{emReais(plano.anual)} no ano</strong> —{" "}
                  {MESES_DE_BRINDE} meses de brinde, {emReais(plano.economia)} de economia.
                </p>

                <ul className="mt-6 space-y-2.5 text-carvao-suave">
                  {plano.recursos.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/criar-conta"
                  className={`mt-8 px-8 py-3.5 text-base ${plano.destaque ? "botao" : "botao-suave"}`}
                >
                  Começar com o {plano.nome}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 rounded-xl2 border border-areia-escura/70 bg-creme p-8 md:grid-cols-2 md:p-10">
            <div>
              <h3 className="font-display text-xl font-semibold text-carvao">
                O pagamento é por Pix
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-suave">
                No painel você escolhe o plano e o QR Code aparece com o valor correto.
                Faz o Pix, avisa com um clique e pronto. São {DIAS_DE_TESTE} dias de
                teste antes de qualquer cobrança, e não pedimos cartão para começar.
              </p>
            </div>

            <ul className="space-y-2.5 text-sm text-carvao-suave">
              {[
                "Sem fidelidade: cancele quando quiser",
                "Sem multa e sem taxa de adesão",
                "Troque de plano a qualquer momento",
                "Seus dados continuam guardados se você pausar",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="font-display text-3xl font-semibold text-carvao md:text-4xl">
            Perguntas que a gente sempre ouve
          </h2>
          <div className="mt-8 space-y-4">
            {perguntas.map((item) => (
              <details key={item.pergunta} className="cartao group">
                <summary className="cursor-pointer list-none font-display text-lg font-semibold text-carvao marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.pergunta}
                    <span
                      className="text-terracota transition group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-carvao-suave">{item.resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-xl2 bg-inverso px-8 py-14 text-center md:px-16">
            <h2 className="font-display text-3xl font-semibold text-inverso-texto md:text-4xl">
              Seu estúdio organizado ainda hoje
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-inverso-texto/75">
              Crie sua conta, use por {DIAS_DE_TESTE} dias e veja se a sua rotina fica mais
              leve. Se não ficar, basta não assinar — sem compromisso nenhum.
            </p>
            <Link
              href="/criar-conta"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-superficie px-8 py-3.5 text-base font-semibold text-carvao transition hover:bg-areia"
            >
              Começar de graça
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-areia-escura/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-carvao-suave sm:flex-row">
          <Marca />
          <p>Feito com carinho para quem cuida de pessoas.</p>
        </div>
      </footer>
    </div>
  );
}
