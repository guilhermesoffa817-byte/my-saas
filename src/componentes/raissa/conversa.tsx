export type MensagemConversa = {
  de: "cliente" | "robo" | "humano" | "aviso";
  texto: string;
  hora?: string;
};

type PropsConversa = {
  /** Nome que aparece no topo da conversa, como no aplicativo. */
  contato: string;
  situacao: string;
  mensagens: MensagemConversa[];
  /** Selo do canto superior deixando claro que a conversa é ilustração. */
  selo: string;
  /** Texto abaixo da conversa explicando que nada ali é caso real de cliente. */
  legenda: string;
  resultado?: string;
  /** Cor da legenda: "escuro" para fundo escuro, "claro" para fundo claro. */
  fundo?: "escuro" | "claro";
};

const ETIQUETAS = {
  robo: { texto: "Atendimento automático", cor: "text-emerald-700" },
  humano: { texto: "Atendente", cor: "text-sky-700" },
} as const;

export function Conversa({
  contato,
  situacao,
  mensagens,
  selo,
  legenda,
  resultado,
  fundo = "escuro",
}: PropsConversa) {
  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900 shadow-2xl shadow-zinc-950/40">
        <div className="flex items-center justify-between gap-3 bg-[#075e54] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              {contato.slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-white">{contato}</span>
              <span className="block text-[11px] text-emerald-100/80">{situacao}</span>
            </span>
          </div>
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-50">
            {selo}
          </span>
        </div>

        <div className="space-y-2.5 bg-[#ece5dd] px-3.5 py-5 sm:px-5">
          {mensagens.map((mensagem, indice) => {
            if (mensagem.de === "aviso") {
              return (
                <p
                  key={indice}
                  className="mx-auto w-fit max-w-[92%] rounded-full bg-[#fdf4c9] px-3.5 py-1.5 text-center text-[11px] font-medium text-[#6b6141] shadow-sm"
                >
                  {mensagem.texto}
                </p>
              );
            }

            const doCliente = mensagem.de === "cliente";
            const etiqueta = mensagem.de === "cliente" ? null : ETIQUETAS[mensagem.de];

            return (
              <div
                key={indice}
                className={`flex ${doCliente ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-800 shadow-sm sm:text-sm ${
                    doCliente
                      ? "rounded-tl-sm bg-white"
                      : "rounded-tr-sm bg-[#dcf8c6]"
                  }`}
                >
                  {etiqueta ? (
                    <span
                      className={`mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${etiqueta.cor}`}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      {etiqueta.texto}
                    </span>
                  ) : null}
                  <span className="block whitespace-pre-line">{mensagem.texto}</span>
                  {mensagem.hora ? (
                    <span className="mt-1 block text-right text-[10px] text-zinc-500">
                      {mensagem.hora}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {resultado ? (
          <p className="flex items-center justify-center gap-2 bg-emerald-500 px-4 py-3 text-center text-sm font-bold text-emerald-950">
            {resultado}
          </p>
        ) : null}
      </div>

      <figcaption
        className={`mt-3 text-center text-xs leading-relaxed ${
          fundo === "escuro" ? "text-zinc-400" : "text-zinc-500"
        }`}
      >
        {legenda}
      </figcaption>
    </figure>
  );
}
