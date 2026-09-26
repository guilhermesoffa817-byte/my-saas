import { emReais } from "@/lib/formato";

export type DiaDoGrafico = {
  rotulo: string;
  nomeCompleto: string;
  atendimentos: number;
  centavos: number;
};

/**
 * Faturamento por dia da semana. Uma medida só, um eixo só — a quantidade de
 * atendimentos vive no rótulo de cada barra, e não num segundo eixo, que
 * confundiria as duas escalas.
 */
export function GraficoPorDiaDaSemana({ dias }: { dias: DiaDoGrafico[] }) {
  const maior = Math.max(...dias.map((dia) => dia.centavos), 1);
  const temMovimento = dias.some((dia) => dia.centavos > 0);
  const melhor = dias.reduce((a, b) => (b.centavos > a.centavos ? b : a));

  return (
    <div className="cartao">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Seus dias mais fortes
        </h2>
        <p className="text-sm text-carvao-suave">Últimos 90 dias</p>
      </div>

      {temMovimento ? (
        <p className="mt-1 text-sm text-carvao-suave">
          <strong className="text-carvao">{melhor.nomeCompleto}</strong> é o dia que mais
          traz dinheiro para o seu estúdio.
        </p>
      ) : (
        <p className="mt-1 text-sm text-carvao-suave">
          Assim que você concluir os primeiros atendimentos, o gráfico se desenha aqui.
        </p>
      )}

      <div className="mt-6 flex h-52 items-end justify-between gap-2 sm:gap-3">
        {dias.map((dia, posicao) => {
          const altura = temMovimento ? Math.max((dia.centavos / maior) * 100, 2) : 2;
          const destaque = temMovimento && dia.centavos === maior;

          return (
            <div key={dia.rotulo} className="flex h-full flex-1 flex-col justify-end gap-2">
              <p
                className={`text-center text-[11px] leading-tight font-semibold tabular-nums ${
                  destaque ? "text-carvao" : "text-transparent"
                }`}
                aria-hidden={!destaque}
              >
                {emReais(dia.centavos)}
              </p>

              <div
                title={`${dia.nomeCompleto}: ${emReais(dia.centavos)} em ${dia.atendimentos} ${
                  dia.atendimentos === 1 ? "atendimento" : "atendimentos"
                }`}
                style={{
                  height: `${altura}%`,
                  animationDelay: `${posicao * 60}ms`,
                }}
                className={`animar-barra origin-bottom rounded-t-[4px] transition-colors ${
                  destaque ? "bg-terracota" : "bg-terracota/35 hover:bg-terracota/60"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between gap-2 sm:gap-3">
        {dias.map((dia) => (
          <p
            key={dia.rotulo}
            className="flex-1 text-center text-[11px] font-semibold tracking-wide text-carvao-suave uppercase"
          >
            {dia.rotulo}
          </p>
        ))}
      </div>

      {/* Os mesmos números em texto, para quem lê por leitor de tela ou prefere tabela. */}
      <details className="mt-5 border-t border-areia-escura/60 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-carvao-suave">
          Ver os números em tabela
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-areia-escura/60 text-left text-carvao-suave">
                <th className="py-2 font-medium">Dia</th>
                <th className="py-2 text-right font-medium">Atendimentos</th>
                <th className="py-2 text-right font-medium">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((dia) => (
                <tr key={dia.rotulo} className="border-b border-areia-escura/40 last:border-0">
                  <td className="py-2 text-carvao">{dia.nomeCompleto}</td>
                  <td className="py-2 text-right tabular-nums text-carvao-suave">
                    {dia.atendimentos}
                  </td>
                  <td className="py-2 text-right tabular-nums text-carvao">
                    {emReais(dia.centavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
