import { ITENS_MENU, NEGOCIO } from "../dados";

export function Rodape() {
  const ano = new Date().getFullYear();

  return (
    <footer className="bg-zinc-950 py-12 text-zinc-400">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 border-b border-white/10 pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-base font-black text-emerald-950">
                RS
              </span>
              <span className="text-lg font-bold text-white">{NEGOCIO.nome}</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Automação de atendimento no WhatsApp para comércio, clínica,
              imobiliária e qualquer negócio que vende conversando.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-white">Na página</p>
              <ul className="mt-3 space-y-2">
                {ITENS_MENU.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-sm transition hover:text-emerald-400">
                      {item.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold text-white">Contato</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>WhatsApp {NEGOCIO.numeroExibicao}</li>
                <li>
                  {NEGOCIO.cidade}, {NEGOCIO.bairro}
                </li>
                <li>Atendimento por mensagem, todos os dias</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="pt-6 text-xs leading-relaxed">
          © {ano} {NEGOCIO.nome}. As conversas mostradas nesta página são exemplos
          ilustrativos do serviço, não conversas de clientes reais. WhatsApp e
          Meta são marcas dos seus respectivos donos.
        </p>
      </div>
    </footer>
  );
}
