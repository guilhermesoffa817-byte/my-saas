import Link from "next/link";
import { Marca } from "@/componentes/marca";
import {
  PLANOS,
  DIAS_DE_TESTE,
  MESES_DE_BRINDE,
  ECONOMIA_ANUAL_CENTAVOS,
} from "@/lib/assinatura";
import { BotaoTema } from "@/componentes/tema";
import { emReais } from "@/lib/formato";

const recursos = [
  {
    titulo: "Agenda que cabe na sua rotina",
    texto:
      "Marque um horário em segundos, veja o dia inteiro numa olhada e saiba quem já confirmou.",
  },
  {
    titulo: "A ficha de cada cliente",
    texto:
      "Telefone, aniversário, alergias, o que ela gostou da última vez. Tudo guardado com carinho.",
  },
  {
    titulo: "Seus serviços e preços",
    texto:
      "Cadastre limpeza de pele, design, massagem... com preço e duração. Na hora de agendar já vem tudo pronto.",
  },
  {
    titulo: "Quanto entrou no mês",
    texto:
      "O painel soma os atendimentos concluídos e mostra o faturamento sem você abrir planilha nenhuma.",
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
    texto: "Cadastre seus serviços e suas clientes. Se precisar de ajuda, é só chamar a gente.",
  },
  {
    numero: "3",
    titulo: "Assine quando gostar",
    texto: `Um Pix de ${emReais(PLANOS.mensal.valorCentavos)} por mês, ou ${emReais(PLANOS.anual.valorCentavos)} no ano. Sem fidelidade, sem letra miúda.`,
  },
];

const perguntas = [
  {
    pergunta: "Preciso assinar contrato ou ficar preso por algum tempo?",
    resposta:
      "Não. A assinatura é mês a mês. Se um mês você não puder pagar, é só não fazer o Pix — seus dados continuam guardadinhos esperando você voltar.",
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta: `No painel você escolhe mensal ou anual, faz o Pix pelo QR Code que aparece lá e avisa com um clique. Assim que conferirmos, seu acesso é liberado.`,
  },
  {
    pergunta: "Funciona no celular?",
    resposta:
      "Funciona sim. O sistema abre no navegador do celular, do tablet ou do computador — o que estiver mais perto de você na hora do atendimento.",
  },
  {
    pergunta: "E se eu tiver dúvida no meio do caminho?",
    resposta:
      "A gente responde de verdade. Nada de robô com resposta pronta: você fala com uma pessoa, do jeito que deveria ser.",
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
                Agenda, ficha das clientes, serviços e faturamento num lugar só — simples
                do jeito que o seu dia já é corrido. Nada de planilha perdida nem caderninho
                que some bem na hora.
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
                Sem cartão de crédito para começar. Prometido.
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
          <div className="grid gap-8 rounded-xl2 border border-areia-escura/70 bg-superficie p-8 shadow-[0_20px_60px_-40px_rgba(14,31,23,0.55)] md:grid-cols-2 md:p-12">
            <div>
              <span className="etiqueta border border-areia-escura bg-areia/60 text-carvao-suave">
                Um plano só, sem pegadinha
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-carvao md:text-4xl">
                Plano Estúdio
              </h2>
              <p className="mt-3 flex items-end gap-2">
                <span className="font-display text-5xl font-semibold text-terracota">
                  {emReais(PLANOS.mensal.valorCentavos)}
                </span>
                <span className="pb-2 text-carvao-suave">por mês</span>
              </p>
              <p className="mt-2 text-sm text-carvao-suave">
                Ou{" "}
                <strong className="text-carvao">
                  {emReais(PLANOS.anual.valorCentavos)} no ano
                </strong>{" "}
                — {MESES_DE_BRINDE} meses de brinde, {emReais(ECONOMIA_ANUAL_CENTAVOS)} de
                economia.
              </p>
              <ul className="mt-6 space-y-2.5 text-carvao-suave">
                {[
                  "Agenda completa, quantos atendimentos você quiser",
                  "Clientes e serviços sem limite",
                  "Faturamento do mês calculado sozinho",
                  "Suporte com gente de verdade",
                  `${DIAS_DE_TESTE} dias para testar antes de pagar`,
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/criar-conta" className="botao mt-8 px-8 py-3.5 text-base">
                Criar minha conta
              </Link>
            </div>

            <div className="rounded-xl2 bg-creme p-7">
              <h3 className="font-display text-xl font-semibold text-carvao">
                O pagamento é por Pix
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-suave">
                No painel você escolhe mensal ou anual e o QR Code aparece com o valor
                certo. Faz o Pix, avisa com um clique e pronto.
              </p>

              <div className="mt-5 rounded-2xl border border-areia-escura bg-superficie p-5">
                <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                  Vantagens do anual
                </p>
                <ul className="mt-3 space-y-2 text-sm text-carvao-suave">
                  {[
                    `${MESES_DE_BRINDE} meses de brinde`,
                    `${emReais(ECONOMIA_ANUAL_CENTAVOS)} de economia no ano`,
                    "Preço travado por 12 meses",
                    "Um Pix só no ano inteiro",
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

              <p className="mt-5 text-sm leading-relaxed text-carvao-suave">
                Assim que a gente confirmar o seu Pix, seu acesso é renovado. Se der
                qualquer problema, a gente resolve junto com você.
              </p>
            </div>
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
              Crie a conta, teste {DIAS_DE_TESTE} dias e veja se a sua rotina fica mais leve.
              Se não ficar, é só não assinar — sem ressentimento.
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
