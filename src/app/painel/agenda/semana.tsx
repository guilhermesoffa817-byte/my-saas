import Link from "next/link";
import {
  diaDaSemanaCurto,
  diaDoMes,
  paraDataLocal,
  somarDias,
} from "@/lib/formato";

export type DiaDaSemana = {
  data: Date;
  chave: string;
  atendimentos: number;
};

/**
 * Barra de dias no estilo do dock do macOS: os sete dias lado a lado, o dia
 * aberto em destaque e subindo um pouco, e um pontinho embaixo de quem tem
 * atendimento marcado.
 */
export function DockDaSemana({
  dias,
  selecionado,
  hoje,
}: {
  dias: DiaDaSemana[];
  selecionado: string;
  hoje: string;
}) {
  const semanaAnterior = paraDataLocal(somarDias(dias[0].data, -7));
  const semanaSeguinte = paraDataLocal(somarDias(dias[0].data, 7));

  return (
    <div className="flex items-center gap-2">
      <SetaDeSemana destino={semanaAnterior} sentido="anterior" />

      <div className="flex flex-1 items-end justify-between gap-1 rounded-2xl border border-areia-escura/70 bg-superficie/70 p-2 backdrop-blur sm:gap-2 sm:p-2.5">
        {dias.map((dia) => {
          const aberto = dia.chave === selecionado;
          const ehHoje = dia.chave === hoje;

          return (
            <Link
              key={dia.chave}
              href={`/painel/agenda?dia=${dia.chave}`}
              aria-current={aberto ? "date" : undefined}
              title={`${dia.atendimentos} ${dia.atendimentos === 1 ? "atendimento" : "atendimentos"}`}
              className={`group flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-transform duration-150 will-change-transform sm:px-2 ${
                aberto
                  ? "-translate-y-1 bg-terracota text-acento-texto shadow-lg shadow-terracota/25"
                  : "text-carvao-suave hover:-translate-y-0.5 hover:bg-areia/70 hover:text-carvao"
              }`}
            >
              <span className="text-[11px] font-semibold tracking-wide uppercase">
                {diaDaSemanaCurto(dia.data)}
              </span>
              <span
                className={`font-display text-lg leading-none font-semibold tabular-nums ${
                  aberto ? "" : ehHoje ? "text-terracota" : "text-carvao"
                }`}
              >
                {diaDoMes(dia.data)}
              </span>

              {/* O pontinho é o que o dock faz com app aberto. */}
              <span
                aria-hidden
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  dia.atendimentos === 0
                    ? "bg-transparent"
                    : aberto
                      ? "bg-acento-texto"
                      : "bg-terracota"
                }`}
              />
            </Link>
          );
        })}
      </div>

      <SetaDeSemana destino={semanaSeguinte} sentido="seguinte" />
    </div>
  );
}

function SetaDeSemana({
  destino,
  sentido,
}: {
  destino: string;
  sentido: "anterior" | "seguinte";
}) {
  const anterior = sentido === "anterior";

  return (
    <Link
      href={`/painel/agenda?dia=${destino}`}
      aria-label={anterior ? "Semana anterior" : "Próxima semana"}
      className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-areia-escura text-carvao-suave transition hover:border-terracota hover:text-terracota"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={anterior ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </Link>
  );
}
