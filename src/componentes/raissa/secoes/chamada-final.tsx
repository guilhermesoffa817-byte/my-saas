import { BotaoWhatsApp } from "../botao-whatsapp";
import { NEGOCIO } from "../dados";
import { IconeCheque } from "../icones";

const MOTIVOS = [
  "Preço baixo de verdade, sem cortar a qualidade do atendimento",
  "Equipe com experiência em atendimento automatizado no WhatsApp",
  "Configuração e acompanhamento feitos por gente que atende você direto",
];

export function ChamadaFinal() {
  return (
    <section className="relative overflow-hidden bg-emerald-500 py-20 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-[24rem] w-[24rem] rounded-full bg-white/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-3xl font-black leading-tight tracking-tight text-emerald-950 sm:text-4xl lg:text-5xl">
          Automação boa não precisa ser cara — e atendimento barato não precisa
          ser malfeito
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-emerald-950/85">
          Esse é o acordo que a {NEGOCIO.nome} faz com você: mensalidade baixa,
          atendimento bem feito e uma equipe que já trabalha com isso cuidando da
          configuração. Você manda uma mensagem, a gente entende o seu
          atendimento e diz o que dá para automatizar no seu caso.
        </p>

        <ul className="mx-auto mt-9 flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:justify-center">
          {MOTIVOS.map((motivo) => (
            <li
              key={motivo}
              className="flex flex-1 gap-2.5 rounded-2xl bg-emerald-950/10 p-4 text-left text-sm font-medium text-emerald-950"
            >
              <IconeCheque className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{motivo}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-4">
          <BotaoWhatsApp origem="chamada-final" variante="branco">
            Falar com a {NEGOCIO.nome} no WhatsApp
          </BotaoWhatsApp>
          <p className="text-sm font-semibold text-emerald-950/70">
            {NEGOCIO.numeroExibicao} · {NEGOCIO.cidade}, {NEGOCIO.bairro}
          </p>
        </div>
      </div>
    </section>
  );
}
