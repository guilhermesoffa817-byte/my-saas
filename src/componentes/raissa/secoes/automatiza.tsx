import { AUTOMACOES } from "../dados";
import { IconeCheque, IconeEquipe, IconeRelogio, IconeRetomada } from "../icones";

const ICONES = [IconeRelogio, IconeEquipe, IconeRetomada];

export function Automatiza() {
  return (
    <section id="automatiza" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            O que automatiza
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            Três coisas que o seu WhatsApp passa a fazer sozinho
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Comércio, clínica, imobiliária, prestador de serviço: quem vende pelo
            WhatsApp perde cliente pelo mesmo motivo — mensagem demais e gente de
            menos para responder. A automação cuida da parte repetitiva e deixa a
            sua equipe para o que fecha venda.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {AUTOMACOES.map((automacao, indice) => {
            const Icone = ICONES[indice];

            return (
              <article
                key={automacao.titulo}
                className="flex flex-col rounded-3xl border border-zinc-200 bg-zinc-50/70 p-7 transition hover:border-emerald-300 hover:bg-white hover:shadow-xl hover:shadow-emerald-900/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                  <Icone />
                </span>

                <h3 className="mt-5 text-xl font-bold text-zinc-900">
                  {automacao.titulo}
                </h3>
                <p className="mt-2 font-medium text-zinc-700">{automacao.resumo}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
                  {automacao.texto}
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-zinc-200 pt-5">
                  {automacao.itens.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-zinc-700">
                      <IconeCheque className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
