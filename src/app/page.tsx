import Link from "next/link";
import { CenaDoDia } from "@/componentes/cenas";
import { CabecalhoDoSite, RodapeDoSite } from "@/componentes/site";
import { Icone } from "@/componentes/ui/icones";
import {
  PLANOS,
  DIAS_DE_TESTE,
  MESES_DE_BRINDE,
} from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { textosDoPlano } from "@/lib/itens-dos-planos";
import {
  DESCRICAO_CURTA,
  ENDERECO_DO_SITE,
  FRASE_DA_MARCA,
  NOME_DO_PRODUTO,
  SEGMENTOS,
} from "@/lib/site";

/**
 * A página de vendas.
 *
 * Quem chega tem poucos segundos para entender o que é isto. Por isso ela é
 * curta: uma promessa concreta, os problemas do dia a dia que o Bossa resolve,
 * as funções em seis blocos, como começar, o preço e as dúvidas de sempre.
 *
 * Nenhuma frase aqui promete o que o produto não faz. As listas dos planos vêm
 * de itens-dos-planos.ts, a mesma fonte da tela de assinatura, e um teste
 * confere que elas batem com a liberação de verdade em recursos.ts.
 */

/** Pares de problema e solução. Curtos, com a palavra que a dona usaria. */
const PROBLEMAS = [
  {
    problema: "Dois clientes no mesmo horário",
    solucao: "A agenda avisa na hora e não deixa o horário bater.",
  },
  {
    problema: "Cliente que esquece de pagar",
    solucao: "A cobrança sai pronta no WhatsApp, com o código Pix. Você confere e envia.",
  },
  {
    problema: "Conta que vence e você só lembra depois",
    solucao: "As contas a pagar aparecem no Início antes de vencer.",
  },
  {
    problema: "Papelada acumulada",
    solucao: "Mande a foto da conta ou do contrato: o Bossa lê valores e datas, e você confere.",
  },
  {
    problema: "Não sabe quanto sobrou no mês",
    solucao: "Entrou, saiu e sobrou numa tela, com custos fixos e variáveis separados.",
  },
  {
    problema: "Cliente querendo marcar às 23h",
    solucao: "Mande o seu link: ele escolhe o serviço e um horário livre sozinho.",
  },
];

/** As funções, agrupadas do jeito que a dona pensa no trabalho, não como o menu. */
const FUNCOES = [
  {
    icone: "calendario",
    titulo: "Agenda e link de agendamento",
    texto: "A semana numa tela e um link para o cliente marcar nos horários que você abrir.",
    vip: false,
  },
  {
    icone: "dinheiro",
    titulo: "Cobranças",
    texto: "Quem cobrar hoje, com a mensagem e o Pix prontos para o WhatsApp.",
    vip: false,
  },
  {
    icone: "papel",
    titulo: "Contas e documentos lidos por IA",
    texto: "Contas a pagar no lugar certo, e a foto do contrato vira datas e valores para conferir.",
    vip: true,
  },
  {
    icone: "grafico",
    titulo: "Finanças, custos e relatório para o contador",
    texto: "O que entrou e saiu, quanto faturar para empatar e o mês em planilha para o contador.",
    vip: true,
  },
  {
    icone: "cracha",
    titulo: "Equipe",
    texto: "Quem trabalha com você, ausências na agenda e pagamentos que já entram como despesa.",
    vip: true,
  },
  {
    icone: "conversa",
    titulo: "Assistente que entende o seu negócio",
    texto: "Pergunte “em que dia a agenda fica mais vazia?” e receba a resposta com os seus números.",
    vip: true,
  },
];

const PASSOS = [
  {
    titulo: "Crie a sua conta",
    texto: "Nome, e-mail e senha. Leva um minuto e não pede cartão.",
  },
  {
    titulo: "Cadastre os seus serviços",
    texto: "Preço e duração de cada um. Os clientes entram aos poucos, no dia a dia.",
  },
  {
    titulo: "Mande o seu link e use a agenda",
    texto: "Divulgue o link no WhatsApp e no Instagram e acompanhe tudo pelo Início.",
  },
];

type Pergunta = {
  pergunta: string;
  resposta: string;
  link?: { href: string; rotulo: string };
};

const PERGUNTAS: Pergunta[] = [
  {
    pergunta: "O Bossa substitui o meu contador?",
    resposta:
      "Não. O Bossa organiza os números e prepara o relatório do mês para o contador. O imposto que aparece é só uma estimativa, feita com o percentual que você informa. O imposto devido, as guias e a folha de pagamento continuam com o seu contador.",
  },
  {
    pergunta: "Preciso instalar alguma coisa?",
    resposta: "Não. O Bossa abre no navegador do celular ou do computador, com o seu e-mail e a sua senha.",
  },
  {
    pergunta: "Ele manda mensagem sozinho para os meus clientes?",
    resposta:
      "Não. Ele abre o WhatsApp com a mensagem e o código Pix prontos. Você confere e aperta enviar. O dinheiro vai direto para a sua chave Pix.",
  },
  {
    pergunta: "Como funciona o teste grátis?",
    resposta: `São ${DIAS_DE_TESTE} dias com as funções do Essencial, sem cartão. Para continuar, você paga por Pix o plano que escolher. As funções do VIP abrem quando você assina o VIP.`,
  },
  {
    pergunta: "A inteligência artificial vê os meus clientes?",
    resposta:
      "No assistente e na classificação de custos, a IA recebe totais e descrições sem dados pessoais, nunca nome, telefone ou CPF dos seus clientes. Na leitura de documentos, ela lê o arquivo que você enviar. Tudo isso só no VIP e só quando você usa.",
    link: { href: "/privacidade", rotulo: "Ver a Política de privacidade" },
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Pode. Não tem fidelidade nem multa. Se você não renovar, o acesso pausa e os seus dados ficam guardados para quando voltar.",
  },
  {
    pergunta: "Serve para o meu negócio?",
    resposta: `Serve para quem atende com hora marcada: ${SEGMENTOS.join(", ")} e outros serviços parecidos.`,
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

/** As mesmas perguntas da tela, no formato que o Google entende. */
const perguntasParaOGoogle = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PERGUNTAS.map((item) => ({
    "@type": "Question",
    name: item.pergunta,
    acceptedAnswer: { "@type": "Answer", text: item.resposta },
  })),
};

const PLANOS_DA_VITRINE = [
  {
    nome: "Essencial",
    resumo: "Para organizar a agenda e receber em dia.",
    mensal: PLANOS.mensal.valorCentavos,
    anual: PLANOS.anual.valorCentavos,
    itens: textosDoPlano("essencial"),
    destaque: false,
  },
  {
    nome: "VIP",
    resumo: "Para cuidar também das contas, da equipe e do dinheiro.",
    mensal: PLANOS.vip_mensal.valorCentavos,
    anual: PLANOS.vip_anual.valorCentavos,
    itens: textosDoPlano("vip"),
    destaque: true,
  },
];

function TituloDaSecao({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-2xl leading-tight font-semibold text-balance text-carvao sm:text-3xl"
    >
      {children}
    </h2>
  );
}

export default function PaginaInicial() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosParaOGoogle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(perguntasParaOGoogle) }}
      />

      <CabecalhoDoSite />

      <main>
        {/* 1. A promessa */}
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 pt-8 pb-20 sm:px-5 md:grid-cols-[1.15fr_1fr] md:pt-16 md:pb-28">
          <div className="animar-entrada">
            <p className="text-sm font-semibold text-terracota">
              Sistema de agendamento e cobrança para estúdios
            </p>
            <h1 className="mt-3 font-display text-[2.15rem] leading-[1.1] font-semibold text-balance text-carvao sm:text-5xl">
              Sua agenda, suas cobranças e seu dinheiro, resolvidos no celular.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-carvao-suave">
              Marque horários, cobre pelo WhatsApp com Pix e veja quanto sobrou no mês. Abre no
              navegador, sem instalar nada.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/criar-conta" className="botao px-8 py-3.5 text-base">
                Testar {DIAS_DE_TESTE} dias grátis
              </Link>
              <Link href="#planos" className="botao-suave px-6 py-3 text-base">
                Ver planos
              </Link>
            </div>
            <p className="mt-3 text-sm text-carvao-suave">Sem cartão. Cancele quando quiser.</p>
          </div>

          <div className="animar-entrada" style={{ animationDelay: "120ms" }}>
            <CenaDoDia />
          </div>
        </section>

        {/* 2. O que muda no dia */}
        <section
          aria-labelledby="o-que-muda"
          className="border-y border-areia-escura/60 bg-superficie/70"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-5 md:py-24">
            <TituloDaSecao id="o-que-muda">O que muda no seu dia</TituloDaSecao>
            <ul className="mt-10 divide-y divide-areia-escura/70 border-y border-areia-escura/70">
              {PROBLEMAS.map((item) => (
                <li
                  key={item.problema}
                  className="grid gap-1 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-8"
                >
                  <p className="font-semibold text-carvao">{item.problema}</p>
                  <p className="flex gap-2.5 leading-relaxed text-carvao-suave">
                    <span aria-hidden className="text-terracota">
                      →
                    </span>
                    <span>{item.solucao}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. As funções */}
        <section aria-labelledby="funcoes" className="mx-auto max-w-5xl px-4 py-16 sm:px-5 md:py-24">
          <TituloDaSecao id="funcoes">Tudo num lugar só</TituloDaSecao>
          <p className="mt-3 max-w-xl text-carvao-suave">
            Seis partes que conversam entre si: o horário concluído entra nas finanças, o
            pagamento da equipe vira despesa, o documento lido vira conta a pagar.
          </p>
          <ul className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCOES.map((funcao) => (
              <li key={funcao.titulo} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-areia text-terracota">
                  <Icone nome={funcao.icone} className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display font-semibold text-carvao">
                    {funcao.titulo}
                    {funcao.vip ? (
                      <span className="ml-2 inline-block rounded-full border border-areia-escura px-2 py-px align-middle text-[11px] font-semibold text-carvao-suave">
                        VIP
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-suave">{funcao.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. Como começa */}
        <section
          aria-labelledby="como-comeca"
          className="border-y border-areia-escura/60 bg-superficie/70"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-5 md:py-24">
            <TituloDaSecao id="como-comeca">Como começa</TituloDaSecao>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {PASSOS.map((passo, posicao) => (
                <li key={passo.titulo} className="flex gap-4 md:block">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracota font-display text-sm font-bold text-acento-texto">
                    {posicao + 1}
                  </span>
                  <div className="md:mt-4">
                    <h3 className="font-display font-semibold text-carvao">{passo.titulo}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-carvao-suave">{passo.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Planos */}
        <section
          id="planos"
          aria-labelledby="titulo-planos"
          className="mx-auto max-w-5xl scroll-mt-8 px-4 py-16 sm:px-5 md:py-24"
        >
          <TituloDaSecao id="titulo-planos">Dois planos, sem fidelidade</TituloDaSecao>
          <p className="mt-3 max-w-xl text-carvao-suave">
            Pagamento por Pix. No plano anual, {MESES_DE_BRINDE} meses saem de brinde.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PLANOS_DA_VITRINE.map((plano) => (
              <div
                key={plano.nome}
                className={`cartao flex flex-col ${
                  plano.destaque ? "border-terracota ring-1 ring-terracota/25" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-semibold text-carvao">{plano.nome}</h3>
                  {plano.destaque ? (
                    <span className="etiqueta bg-terracota text-acento-texto">Mais completo</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-carvao-suave">{plano.resumo}</p>

                <p className="mt-5 flex items-end gap-2">
                  <span className="font-display text-4xl font-semibold text-carvao tabular-nums">
                    {emReais(plano.mensal)}
                  </span>
                  <span className="pb-1.5 text-sm text-carvao-suave">por mês</span>
                </p>
                <p className="mt-1 text-sm text-carvao-suave">
                  Ou {emReais(plano.anual)} por ano.
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-carvao">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-4 w-4 shrink-0 text-terracota"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        aria-hidden
                      >
                        <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/criar-conta"
                  className={`mt-7 w-full ${plano.destaque ? "botao" : "botao-suave"}`}
                >
                  Testar {DIAS_DE_TESTE} dias grátis
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-carvao-suave">
            O teste grátis libera as funções do Essencial. Sem cartão para testar, sem multa para
            sair.
          </p>
        </section>

        {/* 6. Dúvidas */}
        <section
          aria-labelledby="duvidas"
          className="border-t border-areia-escura/60 bg-superficie/70"
        >
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-5 md:py-24">
            <TituloDaSecao id="duvidas">Perguntas frequentes</TituloDaSecao>
            <div className="mt-8 divide-y divide-areia-escura/70 border-y border-areia-escura/70">
              {PERGUNTAS.map((item) => (
                <details key={item.pergunta} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-carvao marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.pergunta}
                    <span
                      aria-hidden
                      className="text-xl leading-none font-normal text-terracota transition group-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 leading-relaxed text-carvao-suave">
                    {item.resposta}
                    {item.link ? (
                      <>
                        {" "}
                        <Link
                          href={item.link.href}
                          className="font-semibold text-terracota underline-offset-4 hover:underline"
                        >
                          {item.link.rotulo}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Chamada final */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-5 md:py-20">
          <div className="rounded-xl2 bg-inverso px-6 py-12 text-center sm:px-8 sm:py-14">
            <h2 className="font-display text-3xl font-semibold text-balance text-inverso-texto">
              Comece hoje. Leva um minuto.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-inverso-texto/80">
              {DIAS_DE_TESTE} dias para usar de verdade, sem cartão. Se não ajudar, é só não
              assinar.
            </p>
            <Link
              href="/criar-conta"
              className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-superficie px-8 py-3.5 text-base font-semibold text-carvao transition hover:bg-areia"
            >
              Criar minha conta
            </Link>
          </div>
        </section>
      </main>

      <RodapeDoSite />
    </div>
  );
}
