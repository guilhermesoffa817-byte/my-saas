/**
 * O relatório do mês na tela. A mesma peça serve à dona (/painel/financas/
 * relatorio) e ao contador (/contador/<código>), e é ela que sai no papel
 * quando alguém aperta "Imprimir ou salvar em PDF": as regras de impressão
 * estão no globals.css, sem biblioteca de PDF.
 *
 * Só mostra totais. Nenhum nome de cliente aparece aqui: o contador precisa do
 * dinheiro do mês, não de quem foi atendido.
 */
import { dataPuraCurta, deDataPura, emReais, percentualBonito } from "@/lib/formato";
import {
  AVISO_DAS_COBRANCAS,
  AVISO_DO_IMPOSTO,
  type RelatorioDoMes,
} from "@/lib/relatorio/montar";

type LinhaDaTabela = {
  rotulo: string;
  quantidade?: number | null;
  valorCentavos: number;
  detalhe?: string;
  destaque?: boolean;
  recuo?: boolean;
};

function dia(texto: string) {
  const data = deDataPura(texto);
  return data ? dataPuraCurta(data) : texto;
}

function Tabela({ linhas, legenda }: { linhas: LinhaDaTabela[]; legenda: string }) {
  return (
    <table className="mt-3 w-full border-collapse text-sm">
      <caption className="sr-only">{legenda}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Quantidade</th>
          <th scope="col">Valor</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, posicao) => (
          <tr
            key={`${linha.rotulo}-${posicao}`}
            className={`border-t border-areia-escura/60 align-top ${linha.destaque ? "font-semibold text-carvao" : "text-carvao-suave"}`}
          >
            <th
              scope="row"
              className={`py-2 pr-3 text-left font-[inherit] ${linha.recuo ? "pl-4" : ""}`}
            >
              <span className={linha.destaque ? "text-carvao" : linha.recuo ? "" : "text-carvao"}>
                {linha.rotulo}
              </span>
              {linha.detalhe ? (
                <span className="block text-xs font-normal text-carvao-suave">{linha.detalhe}</span>
              ) : null}
            </th>
            <td className="w-12 py-2 pr-3 text-right tabular-nums">
              {linha.quantidade === null || linha.quantidade === undefined ? "" : linha.quantidade}
            </td>
            <td className="py-2 text-right whitespace-nowrap tabular-nums text-carvao">
              {emReais(linha.valorCentavos)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bloco({
  titulo,
  explicacao,
  children,
}: {
  titulo: string;
  explicacao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cartao bloco-do-relatorio">
      <h2 className="font-display text-lg font-semibold text-carvao">{titulo}</h2>
      {explicacao ? <p className="mt-1 text-sm text-carvao-suave">{explicacao}</p> : null}
      {children}
    </section>
  );
}

function Numero({
  rotulo,
  valorCentavos,
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valorCentavos: number;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="cartao bloco-do-relatorio p-4 sm:p-5">
      <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">{rotulo}</p>
      <p
        className={`mt-1.5 font-display text-xl font-semibold tabular-nums sm:text-2xl ${
          destaque ? "text-terracota" : "text-carvao"
        }`}
      >
        {emReais(valorCentavos)}
      </p>
      {detalhe ? <p className="mt-1 text-xs text-carvao-suave">{detalhe}</p> : null}
    </div>
  );
}

export function RelatorioNaTela({
  relatorio,
  nomeNegocio,
  situacao,
}: {
  relatorio: RelatorioDoMes;
  nomeNegocio: string;
  /** "Fechado em 05/11/2026 às 10:12" ou "Em aberto". */
  situacao: string;
}) {
  const { entradas, saidas, equipe, resultado, cobrancas, contasAPagar } = relatorio;

  const linhasDeEntrada: LinhaDaTabela[] = [
    {
      rotulo: "Atendimentos concluídos",
      quantidade: entradas.atendimentos.quantidade,
      valorCentavos: entradas.atendimentos.totalCentavos,
    },
    ...entradas.atendimentos.porServico.map((servico) => ({
      rotulo: servico.rotulo,
      quantidade: servico.quantidade,
      valorCentavos: servico.totalCentavos,
      recuo: true,
    })),
    {
      rotulo: "Entradas lançadas à mão",
      quantidade: entradas.manuais.quantidade,
      valorCentavos: entradas.manuais.totalCentavos,
    },
    ...entradas.manuais.porCategoria.map((categoria) => ({
      rotulo: categoria.rotulo,
      quantidade: categoria.quantidade,
      valorCentavos: categoria.totalCentavos,
      recuo: true,
    })),
    {
      rotulo: "Cobranças avulsas recebidas",
      quantidade: entradas.cobrancasRecebidas.quantidade,
      valorCentavos: entradas.cobrancasRecebidas.totalCentavos,
      detalhe: "As da agenda já estão nos atendimentos.",
    },
    { rotulo: "Total de entradas", valorCentavos: entradas.totalCentavos, destaque: true },
  ];

  return (
    <div className="relatorio-do-mes space-y-5">
      <header className="bloco-do-relatorio">
        <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
          Relatório do mês · {nomeNegocio}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-carvao">{relatorio.periodo}</h2>
        <p className="mt-1 text-sm text-carvao-suave">
          {situacao}
          {relatorio.parcial
            ? ` · mês em andamento, números até ${dia(relatorio.referencia)}`
            : ""}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="Entrou"
          valorCentavos={entradas.totalCentavos}
          detalhe={`${entradas.atendimentos.quantidade} atendimentos concluídos`}
          destaque
        />
        <Numero
          rotulo="Saiu"
          valorCentavos={saidas.totalCentavos}
          detalhe={`${saidas.quantidade} ${saidas.quantidade === 1 ? "saída" : "saídas"}`}
        />
        <Numero
          rotulo="Entrou menos saiu"
          valorCentavos={resultado.resultadoCentavos}
          detalhe="antes do imposto estimado"
        />
        <Numero
          rotulo="Imposto estimado"
          valorCentavos={resultado.impostoEstimadoCentavos}
          detalhe={`${percentualBonito(relatorio.impostoPercentual)}% das entradas · não é guia`}
        />
      </div>

      <Bloco titulo="Entradas" explicacao="Atendimentos pelo preço do serviço, mais o que entrou fora da agenda.">
        <Tabela legenda="Entradas do mês" linhas={linhasDeEntrada} />
      </Bloco>

      <Bloco titulo="Saídas por categoria">
        {saidas.porCategoria.length === 0 ? (
          <p className="mt-3 text-sm text-carvao-suave">Nenhuma saída registrada no mês.</p>
        ) : (
          <Tabela
            legenda="Saídas por categoria"
            linhas={[
              ...saidas.porCategoria.map((linha) => ({
                rotulo: linha.rotulo,
                quantidade: linha.quantidade,
                valorCentavos: linha.totalCentavos,
              })),
              { rotulo: "Total de saídas", valorCentavos: saidas.totalCentavos, destaque: true },
            ]}
          />
        )}
      </Bloco>

      <Bloco
        titulo="Saídas por natureza"
        explicacao="Visão de custos: o que você paga mesmo sem atender, o que acompanha os atendimentos e o que fica fora da operação."
      >
        {saidas.porNatureza.length === 0 ? (
          <p className="mt-3 text-sm text-carvao-suave">Nenhuma saída registrada no mês.</p>
        ) : (
          <Tabela
            legenda="Saídas por natureza"
            linhas={saidas.porNatureza.map((linha) => ({
              rotulo: linha.rotulo,
              quantidade: linha.quantidade,
              valorCentavos: linha.totalCentavos,
            }))}
          />
        )}
      </Bloco>

      <Bloco
        titulo="Pagamentos à equipe"
        explicacao="Já estão dentro das saídas. O Bossa não faz folha de pagamento nem calcula encargos."
      >
        {equipe.porTipo.length === 0 ? (
          <p className="mt-3 text-sm text-carvao-suave">Nenhum pagamento à equipe no mês.</p>
        ) : (
          <Tabela
            legenda="Pagamentos à equipe por tipo"
            linhas={[
              ...equipe.porTipo.map((linha) => ({
                rotulo: linha.rotulo,
                quantidade: linha.quantidade,
                valorCentavos: linha.totalCentavos,
              })),
              { rotulo: "Total pago à equipe", valorCentavos: equipe.totalCentavos, destaque: true },
            ]}
          />
        )}
      </Bloco>

      <Bloco titulo="Resultado">
        <Tabela
          legenda="Resultado do mês"
          linhas={[
            { rotulo: "Entrou", valorCentavos: entradas.totalCentavos },
            { rotulo: "Saiu", valorCentavos: -saidas.totalCentavos },
            { rotulo: "Entrou menos saiu", valorCentavos: resultado.resultadoCentavos, destaque: true },
            {
              rotulo: "Imposto estimado",
              valorCentavos: -resultado.impostoEstimadoCentavos,
              detalhe: `${percentualBonito(relatorio.impostoPercentual)}% sobre as entradas`,
            },
            {
              rotulo: "Depois do imposto estimado",
              valorCentavos: resultado.depoisDoImpostoCentavos,
              destaque: true,
            },
          ]}
        />
        <p className="mt-4 rounded-xl border border-areia-escura bg-areia/40 px-4 py-3 text-xs leading-relaxed text-carvao-suave">
          {AVISO_DO_IMPOSTO}
        </p>
      </Bloco>

      <Bloco
        titulo="A receber dos clientes"
        explicacao={
          relatorio.parcial
            ? `Cobranças sem pagamento marcado até ${dia(relatorio.referencia)}.`
            : "Cobranças que estavam sem pagamento na virada do mês."
        }
      >
        <Tabela
          legenda="Cobranças a receber"
          linhas={[
            {
              rotulo: "Em aberto, no prazo",
              quantidade: cobrancas.emAberto.quantidade,
              valorCentavos: cobrancas.emAberto.totalCentavos,
            },
            {
              rotulo: "Atrasadas",
              quantidade: cobrancas.atrasadas.quantidade,
              valorCentavos: cobrancas.atrasadas.totalCentavos,
            },
          ]}
        />
        <p className="mt-3 text-xs text-carvao-suave">{AVISO_DAS_COBRANCAS}</p>
      </Bloco>

      <Bloco titulo="Contas a pagar do mês" explicacao="As contas com vencimento neste mês.">
        {contasAPagar.itens.length === 0 ? (
          <p className="mt-3 text-sm text-carvao-suave">Nenhuma conta com vencimento no mês.</p>
        ) : (
          <Tabela
            legenda="Contas a pagar do mês"
            linhas={[
              ...contasAPagar.itens.map((conta) => ({
                rotulo: conta.descricao,
                valorCentavos: conta.valorCentavos,
                detalhe: `Vence ${dia(conta.dia)} · ${
                  conta.situacao === "paga"
                    ? `paga em ${dia(conta.pagaEm ?? conta.dia)}`
                    : conta.pagaEm
                      ? `paga depois, em ${dia(conta.pagaEm)}`
                      : "em aberto"
                }`,
              })),
              {
                rotulo: "Pagas no mês",
                quantidade: contasAPagar.pagas.quantidade,
                valorCentavos: contasAPagar.pagas.totalCentavos,
                destaque: true,
              },
              {
                rotulo: "Em aberto no fim do mês",
                quantidade: contasAPagar.emAberto.quantidade,
                valorCentavos: contasAPagar.emAberto.totalCentavos,
                destaque: true,
              },
            ]}
          />
        )}
      </Bloco>
    </div>
  );
}
