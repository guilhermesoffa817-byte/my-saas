import { BotaoWhatsApp } from "../botao-whatsapp";
import { IconeCheque, IconeEscudo, IconeTroca } from "../icones";

const MEDOS = [
  {
    icone: IconeEscudo,
    medo: "“E se a Meta bloquear o meu número por usar automação?”",
    titulo: "API oficial da Meta, e é por isso que o número não cai",
    texto:
      "O que derruba número é automação feita por fora: aplicativo clonado, versão modificada do WhatsApp, robô instalado em um celular escondido na gaveta. Nós não trabalhamos assim. A conta do seu negócio é aprovada dentro da plataforma oficial da Meta, com o seu número verificado e o perfil comercial no seu nome. Automatizar por esse caminho é justamente o que a Meta autoriza — o risco de bloqueio existe em quem faz por fora.",
    itens: [
      "Cadastro do número feito com você, dentro do processo oficial da Meta",
      "Nada de WhatsApp clonado, modificado ou celular ligado o dia inteiro",
      "Seu número continua o mesmo, com a conversa antiga preservada",
      "Regras de envio respeitadas, sem disparo em massa para lista comprada",
    ],
  },
  {
    icone: IconeTroca,
    medo: "“E se o robô responder errado e o cliente for embora?”",
    titulo: "O robô cuida do começo e entrega para o humano na hora certa",
    texto:
      "A automação não fica adivinhando resposta. Ela responde o que a gente escreveu junto com você — preço, horário, endereço, formas de pagamento, as dúvidas que a sua equipe repete todo dia. Quando a pergunta sai do que foi combinado, ou quando o cliente pede atendimento, a conversa passa para uma pessoa da sua equipe no mesmo instante e no mesmo número. O cliente não recebe resposta desencontrada nem precisa repetir o que já disse.",
    itens: [
      "Respostas escritas em cima do seu negócio e aprovadas por você antes de entrar no ar",
      "Qualquer atendente assume a conversa a qualquer momento, com um clique",
      "Sem tela travada e sem “digite 1” infinito: quem pede humano, fala com humano",
      "O atendente recebe a conversa inteira, então o cliente não repete nada",
    ],
  },
] as const;

export function Integracao() {
  return (
    <section id="integracao" className="scroll-mt-20 bg-zinc-950 py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            Integração oficial
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            As duas dúvidas que travam quem contrata automação de WhatsApp
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-300">
            Quase todo mundo pergunta a mesma coisa antes de fechar: se o número
            pode ser bloqueado e se o robô vai estragar o atendimento. As duas
            respostas dependem de como o serviço é montado — então aqui vai, sem
            rodeio.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {MEDOS.map((bloco) => {
            const Icone = bloco.icone;

            return (
              <article
                key={bloco.titulo}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 sm:p-8"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <Icone />
                </span>

                <p className="mt-5 text-base font-semibold italic text-zinc-400">
                  {bloco.medo}
                </p>
                <h3 className="mt-3 text-2xl font-bold leading-snug text-white">
                  {bloco.titulo}
                </h3>
                <p className="mt-4 leading-relaxed text-zinc-300">{bloco.texto}</p>

                <ul className="mt-6 space-y-3 border-t border-white/10 pt-6">
                  {bloco.itens.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-zinc-200">
                      <IconeCheque className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-2xl text-base leading-relaxed text-zinc-200">
            Ficou alguma dúvida sobre o número, sobre a conta oficial ou sobre
            como a passagem para o atendente humano funciona no seu caso? Manda a
            pergunta e a gente responde direto, sem enrolação.
          </p>
          <BotaoWhatsApp origem="integracao" tamanho="medio" className="shrink-0">
            Tirar dúvida no WhatsApp
          </BotaoWhatsApp>
        </div>
      </div>
    </section>
  );
}
