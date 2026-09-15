import { Conversa, type MensagemConversa } from "../conversa";
import { IconeCheque } from "../icones";

const CONVERSA_DEMONSTRACAO: MensagemConversa[] = [
  {
    de: "cliente",
    texto: "Boa noite, vocês ainda estão atendendo?",
    hora: "21:07",
  },
  {
    de: "robo",
    texto:
      "Boa noite! O atendimento presencial já encerrou por hoje, mas por aqui eu consigo te ajudar agora mesmo. Você quer saber valores, horários ou falar com um atendente?",
    hora: "21:07",
  },
  {
    de: "cliente",
    texto: "Queria saber o valor e se dá pra marcar amanhã de manhã",
    hora: "21:08",
  },
  {
    de: "robo",
    texto:
      "Valores e o que está incluso eu te mando agora. Para confirmar horário de amanhã eu já chamo um atendente da equipe, tudo bem?",
    hora: "21:08",
  },
  {
    de: "cliente",
    texto: "Tudo bem, pode chamar",
    hora: "21:09",
  },
  {
    de: "aviso",
    texto:
      "Conversa transferida para um atendente humano — mesmo número, mesma conversa, sem o cliente repetir nada",
  },
  {
    de: "humano",
    texto:
      "Oi! Aqui é do atendimento, já estou com tudo o que você conversou. Amanhã tenho 9h e 10h30 livres — qual fica melhor pra você?",
    hora: "21:10",
  },
  {
    de: "cliente",
    texto: "9h tá ótimo, obrigado!",
    hora: "21:11",
  },
];

const PONTOS = [
  {
    titulo: "Mensagem respondida em segundos",
    texto:
      "Às 21h, no domingo ou no feriado, o cliente recebe resposta na hora em vez de ficar no vácuo.",
  },
  {
    titulo: "O robô sabe onde parar",
    texto:
      "Assim que o assunto exige decisão humana — marcar horário, negociar, resolver problema — a conversa muda de mãos.",
  },
  {
    titulo: "A troca acontece sem o cliente perceber travamento",
    texto:
      "É o mesmo número e a mesma conversa. O atendente já abre a tela com todo o histórico e continua de onde parou.",
  },
  {
    titulo: "Você acompanha tudo por dentro",
    texto:
      "No painel dá para ver quem está atendendo cada conversa, o que ficou pendente e o que a automação respondeu sozinha.",
  },
];

export function Demonstracao() {
  return (
    <section id="demonstracao" className="scroll-mt-20 bg-zinc-100 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Demonstração
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            Como fica a conversa do robô até o atendente humano
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Abaixo está uma simulação do fluxo de atendimento, escrita para você
            ver a ordem das coisas. As mensagens são exemplo montado por nós — não
            é conversa de cliente real e não é prova de resultado de ninguém.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <Conversa
            contato="Simulação de atendimento"
            situacao="fluxo de exemplo, fora do horário"
            selo="Simulação"
            mensagens={CONVERSA_DEMONSTRACAO}
            fundo="claro"
            legenda="Simulação do fluxo de atendimento da Raissa Soffa. Mensagens de exemplo, criadas para demonstração — não são conversa de cliente real nem prova de caso atendido."
          />

          <ol className="space-y-5">
            {PONTOS.map((ponto, indice) => (
              <li
                key={ponto.titulo}
                className="flex gap-4 rounded-3xl border border-zinc-200 bg-white p-6"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-emerald-950">
                  {indice + 1}
                </span>
                <span>
                  <span className="block text-lg font-bold text-zinc-900">
                    {ponto.titulo}
                  </span>
                  <span className="mt-1 block leading-relaxed text-zinc-600">
                    {ponto.texto}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-10 flex items-start gap-3 rounded-3xl border border-zinc-300 bg-white/70 p-6 text-[15px] leading-relaxed text-zinc-700">
          <IconeCheque className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <span>
            Quer ver o fluxo montado com as perguntas que o seu negócio recebe
            todo dia? A gente escreve junto com você antes de qualquer coisa
            entrar no ar — nada vai para o cliente sem a sua aprovação.
          </span>
        </p>
      </div>
    </section>
  );
}
