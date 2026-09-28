import { BotaoCopiar } from "@/componentes/botoes";
import { Etiqueta, Vazio } from "@/componentes/avisos";
import { dataCurta, emReais } from "@/lib/formato";

export type ContaIndicada = {
  nome: string;
  nomeNegocio: string;
  criadoEm: Date;
  situacao: "teste" | "ativa" | "aguardando" | "expirada";
  totalPagoCentavos: number;
};

export type Parceiro = {
  nome: string;
  codigo: string;
  contas: ContaIndicada[];
};

const TOM_POR_SITUACAO = {
  ativa: "boa",
  teste: "calma",
  aguardando: "atencao",
  expirada: "erro",
} as const;

const ROTULO_POR_SITUACAO = {
  ativa: "Pagando",
  teste: "Em teste",
  aguardando: "Conferindo Pix",
  expirada: "Vencida",
} as const;

/**
 * Quem indicou quem, e quanto cada parceiro já trouxe. O pagamento da
 * comissão é feito por fora; aqui fica o número para você saber o valor.
 */
export function Indicacoes({
  parceiros,
  enderecoBase,
  percentual,
}: {
  parceiros: Parceiro[];
  enderecoBase: string;
  percentual: number;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-carvao">
          Indicações
        </h2>
        <p className="mt-1 text-sm text-carvao-suave">
          Cada parceiro tem um link próprio. Quem se cadastra por ele fica marcado
          aqui, e a comissão sugerida é de {percentual}% sobre o que a conta já pagou.
        </p>
      </div>

      {parceiros.length === 0 ? (
        <Vazio
          titulo="Nenhum parceiro ainda"
          texto="Quando você criar um link de indicação, ele aparece nesta lista com o resultado."
        />
      ) : (
        parceiros.map((parceiro) => {
          const pagando = parceiro.contas.filter((conta) => conta.situacao === "ativa");
          const totalPago = parceiro.contas.reduce(
            (soma, conta) => soma + conta.totalPagoCentavos,
            0,
          );
          const comissao = Math.round((totalPago * percentual) / 100);
          const link = `${enderecoBase}/criar-conta?ind=${parceiro.codigo}`;

          return (
            <div key={parceiro.codigo} className="cartao space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold text-carvao">
                    {parceiro.nome}
                  </p>
                  <p className="text-sm text-carvao-suave">
                    {parceiro.contas.length}{" "}
                    {parceiro.contas.length === 1 ? "cadastro" : "cadastros"} ·{" "}
                    {pagando.length} pagando
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                    Comissão a pagar
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums text-terracota">
                    {emReais(comissao)}
                  </p>
                  <p className="text-xs text-carvao-suave">
                    de {emReais(totalPago)} recebidos
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-areia-escura bg-creme px-4 py-3">
                <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                  Link do parceiro
                </p>
                <p className="mt-1 font-mono text-xs break-all text-carvao-suave select-all">
                  {link}
                </p>
                <div className="mt-3">
                  <BotaoCopiar texto={link} rotulo="Copiar link" />
                </div>
              </div>

              {parceiro.contas.length === 0 ? (
                <p className="text-sm text-carvao-suave">
                  Ninguém se cadastrou por esse link ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {parceiro.contas.map((conta) => (
                    <li
                      key={`${parceiro.codigo}-${conta.nomeNegocio}-${conta.criadoEm.toISOString()}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-areia-escura/60 pt-2 first:border-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-carvao">
                          {conta.nomeNegocio}
                        </p>
                        <p className="text-xs text-carvao-suave">
                          {conta.nome} · entrou em {dataCurta(conta.criadoEm)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums text-carvao-suave">
                          {emReais(conta.totalPagoCentavos)}
                        </span>
                        <Etiqueta tom={TOM_POR_SITUACAO[conta.situacao]}>
                          {ROTULO_POR_SITUACAO[conta.situacao]}
                        </Etiqueta>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
