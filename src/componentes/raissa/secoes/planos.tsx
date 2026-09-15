import { BotaoWhatsApp } from "../botao-whatsapp";
import { PLANOS } from "../dados";
import { IconeCheque } from "../icones";

export function Planos() {
  return (
    <section id="planos" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Planos
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            Assinatura mensal, do tamanho do seu atendimento
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Você paga por mês e já entra com o número na API oficial da Meta, a
            automação configurada e a nossa equipe acompanhando. Se o movimento
            crescer, é só mudar de plano.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          {PLANOS.map((plano) => (
            <article
              key={plano.nome}
              className={`flex h-full flex-col rounded-3xl p-7 sm:p-8 ${
                plano.destaque
                  ? "border-2 border-emerald-500 bg-zinc-950 text-white shadow-2xl shadow-emerald-900/20 lg:-mt-4 lg:pb-10"
                  : "border border-zinc-200 bg-zinc-50/70 text-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3
                  className={`text-xl font-black ${
                    plano.destaque ? "text-white" : "text-zinc-900"
                  }`}
                >
                  {plano.nome}
                </h3>
                {plano.etiqueta ? (
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-950">
                    {plano.etiqueta}
                  </span>
                ) : null}
              </div>

              <p
                className={`mt-2 text-[15px] leading-relaxed ${
                  plano.destaque ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                {plano.para}
              </p>

              <p className="mt-6 flex flex-wrap items-baseline gap-2">
                <span
                  className={`text-3xl font-black tracking-tight ${
                    plano.destaque ? "text-emerald-400" : "text-zinc-900"
                  }`}
                >
                  {plano.preco}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    plano.destaque ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  por mês
                </span>
              </p>

              <ul
                className={`mt-6 flex-1 space-y-3 border-t pt-6 ${
                  plano.destaque ? "border-white/10" : "border-zinc-200"
                }`}
              >
                {plano.itens.map((item) => (
                  <li
                    key={item}
                    className={`flex gap-2.5 text-sm leading-relaxed ${
                      plano.destaque ? "text-zinc-200" : "text-zinc-700"
                    }`}
                  >
                    <IconeCheque
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plano.destaque ? "text-emerald-400" : "text-emerald-600"
                      }`}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <BotaoWhatsApp
                  origem={`planos-${plano.nome.toLowerCase()}`}
                  tamanho="medio"
                  variante={plano.destaque ? "verde" : "contorno"}
                  className="w-full"
                >
                  Quero o plano {plano.nome}
                </BotaoWhatsApp>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Não sabe qual plano combina com o seu movimento? Conta pra gente quantas
          mensagens você recebe por dia e quantas pessoas respondem — a gente
          indica o menor plano que dá conta.
        </p>
      </div>
    </section>
  );
}
