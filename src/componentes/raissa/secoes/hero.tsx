import { BotaoWhatsApp } from "../botao-whatsapp";
import { Conversa, type MensagemConversa } from "../conversa";
import { NEGOCIO } from "../dados";

const CONVERSA_RECUPERADA: MensagemConversa[] = [
  {
    de: "cliente",
    texto: "Boa tarde! Vi o anúncio de vocês. Quanto fica e dá pra entregar ainda essa semana?",
    hora: "17:42",
  },
  {
    de: "robo",
    texto:
      "Boa tarde! Consigo te passar os valores agora mesmo e a entrega desta semana está aberta. Quer que eu já separe uma opção pra você?",
    hora: "17:42",
  },
  { de: "aviso", texto: "O cliente leu e não respondeu — 1 dia parado" },
  {
    de: "robo",
    texto:
      "Oi! Ficamos na metade da conversa ontem 🙂 A opção que você perguntou continua disponível pra esta semana. Quer que eu chame um atendente pra fechar?",
    hora: "10:18",
  },
  {
    de: "cliente",
    texto: "Ainda quero sim! Pode fechar, só me diz como faço o pagamento",
    hora: "10:26",
  },
  {
    de: "humano",
    texto:
      "Oi! Assumi sua conversa aqui. Já anotei tudo o que você pediu, é só confirmar o endereço que eu fecho o pedido.",
    hora: "10:27",
  },
];

export function Hero() {
  return (
    <section
      id="topo"
      className="relative overflow-hidden bg-zinc-950 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-40 h-[26rem] w-[26rem] rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 sm:text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {NEGOCIO.nome} · {NEGOCIO.cidade}, {NEGOCIO.bairro}
          </p>

          <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Cada mensagem sem resposta no WhatsApp é uma venda indo para o
            concorrente.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
            A {NEGOCIO.nome} monta a automação de atendimento do seu WhatsApp:
            resposta na hora quando ninguém pode responder, conversa distribuída
            entre os atendentes e retomada automática de quem perguntou o preço
            e sumiu. Tudo na API oficial da Meta, com um atendente humano podendo
            assumir a conversa a qualquer momento.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <BotaoWhatsApp origem="hero">Falar no WhatsApp agora</BotaoWhatsApp>
            <a
              href="#planos"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-4 text-base font-semibold text-white transition hover:border-white/50 hover:bg-white/5 sm:text-lg"
            >
              Ver os planos
            </a>
          </div>

          <dl className="mt-10 grid gap-5 border-t border-white/10 pt-8 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-bold text-white">API oficial da Meta</dt>
              <dd className="mt-1 text-sm text-zinc-400">
                Número aprovado pela própria Meta, sem aplicativo clonado.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-white">Humano a qualquer hora</dt>
              <dd className="mt-1 text-sm text-zinc-400">
                Seu atendente entra na conversa sem travar o cliente.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-white">Assinatura mensal</dt>
              <dd className="mt-1 text-sm text-zinc-400">
                Preço baixo com atendimento bem feito e equipe experiente.
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:pl-4">
          <Conversa
            contato="Cliente do seu WhatsApp"
            situacao="conversa que tinha esfriado"
            selo="Ilustração"
            mensagens={CONVERSA_RECUPERADA}
            resultado="Contato parado virou pedido fechado"
            legenda="Exemplo ilustrativo de como o serviço funciona: cliente sumiu, a automação reengatou a conversa e um atendente humano assumiu. Não é conversa de cliente real."
          />
        </div>
      </div>
    </section>
  );
}
