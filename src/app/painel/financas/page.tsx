import { prisma } from "@/lib/prisma";
import { exigirFinanceiro } from "@/lib/guardas";
import { BotaoConfirmar } from "@/componentes/botoes";
import { Vazio } from "@/componentes/avisos";
import {
  dataCurta,
  diaDaSemanaCurto,
  emReais,
  paraDataLocal,
  somarDias,
} from "@/lib/formato";
import { FormularioImposto, FormularioLancamento } from "./formulario";
import { GraficoPorDiaDaSemana, type DiaDoGrafico } from "./grafico";
import { excluirLancamento } from "./acoes";

export const metadata = { title: "Finanças — Agenda Online" };
export const dynamic = "force-dynamic";

const NOMES_DOS_DIAS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

export default async function PaginaFinancas() {
  const { usuario } = await exigirFinanceiro();

  const agora = new Date();
  const inicioDoMes = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
  );
  const inicioDoGrafico = somarDias(agora, -90);

  const [atendimentosDoMes, lancamentosDoMes, atendimentosDoPeriodo] =
    await Promise.all([
      prisma.agendamento.findMany({
        where: {
          usuarioId: usuario.id,
          status: "concluido",
          inicio: { gte: inicioDoMes },
        },
        select: { servico: { select: { precoCentavos: true } } },
      }),
      prisma.lancamento.findMany({
        where: { usuarioId: usuario.id, data: { gte: inicioDoMes } },
        orderBy: { data: "desc" },
      }),
      prisma.agendamento.findMany({
        where: {
          usuarioId: usuario.id,
          status: "concluido",
          inicio: { gte: inicioDoGrafico },
        },
        select: { inicio: true, servico: { select: { precoCentavos: true } } },
      }),
    ]);

  const atendimentosCentavos = atendimentosDoMes.reduce(
    (soma, item) => soma + item.servico.precoCentavos,
    0,
  );
  const entradasManuais = lancamentosDoMes
    .filter((item) => item.tipo === "entrada")
    .reduce((soma, item) => soma + item.valorCentavos, 0);
  const saidas = lancamentosDoMes
    .filter((item) => item.tipo === "saida")
    .reduce((soma, item) => soma + item.valorCentavos, 0);

  const entradas = atendimentosCentavos + entradasManuais;
  const imposto = Math.round((entradas * usuario.impostoPercentual) / 100);
  const sobrou = entradas - saidas - imposto;

  // Segunda a domingo, na ordem em que a semana é vivida no estúdio.
  const porDia = new Map<string, { atendimentos: number; centavos: number }>();
  for (const atendimento of atendimentosDoPeriodo) {
    const chave = diaDaSemanaCurto(atendimento.inicio);
    const atual = porDia.get(chave) ?? { atendimentos: 0, centavos: 0 };
    porDia.set(chave, {
      atendimentos: atual.atendimentos + 1,
      centavos: atual.centavos + atendimento.servico.precoCentavos,
    });
  }

  // A referência é uma segunda-feira conhecida, só para extrair as siglas na ordem.
  const segundaDeReferencia = new Date(Date.UTC(2026, 0, 5, 12));
  const dias: DiaDoGrafico[] = NOMES_DOS_DIAS.map((nomeCompleto, posicao) => {
    const rotulo = diaDaSemanaCurto(somarDias(segundaDeReferencia, posicao));
    const dados = porDia.get(rotulo) ?? { atendimentos: 0, centavos: 0 };
    return { rotulo, nomeCompleto, ...dados };
  });

  const maiorLinha = Math.max(entradas, saidas + imposto, 1);

  return (
    <div className="space-y-8">
      <section className="animar-entrada">
        <h1 className="font-display text-3xl font-semibold text-carvao">
          Suas finanças
        </h1>
        <p className="mt-2 max-w-2xl text-carvao-suave">
          Tudo o que entrou e o que saiu neste mês, reunido num lugar só. Os
          atendimentos concluídos entram sozinhos; o resto você registra abaixo.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Entrou" valor={emReais(entradas)} tom="boa" atraso={0}>
          {emReais(atendimentosCentavos)} de atendimentos
        </Indicador>
        <Indicador titulo="Saiu" valor={emReais(saidas)} tom="neutra" atraso={80}>
          {lancamentosDoMes.filter((item) => item.tipo === "saida").length} despesas
          registradas
        </Indicador>
        <Indicador
          titulo="Imposto estimado"
          valor={emReais(imposto)}
          tom="neutra"
          atraso={160}
        >
          {usuario.impostoPercentual}% sobre o que entrou
        </Indicador>
        <Indicador
          titulo="Sobrou para você"
          valor={emReais(sobrou)}
          tom={sobrou >= 0 ? "destaque" : "atencao"}
          atraso={240}
        >
          depois das despesas e do imposto
        </Indicador>
      </section>

      <section className="cartao animar-entrada">
        <h2 className="font-display text-xl font-semibold text-carvao">
          O mês em uma olhada
        </h2>
        <p className="mt-1 text-sm text-carvao-suave">
          As barras mostram o tamanho de cada valor em relação ao maior deles.
        </p>

        <div className="mt-5 space-y-4">
          <LinhaDoResumo
            rotulo="Atendimentos concluídos"
            valor={atendimentosCentavos}
            maior={maiorLinha}
            cor="bg-terracota"
          />
          <LinhaDoResumo
            rotulo="Outras entradas"
            valor={entradasManuais}
            maior={maiorLinha}
            cor="bg-oliva"
          />
          <LinhaDoResumo
            rotulo="Despesas"
            valor={saidas}
            maior={maiorLinha}
            cor="bg-carvao-suave"
          />
          <LinhaDoResumo
            rotulo="Imposto estimado"
            valor={imposto}
            maior={maiorLinha}
            cor="bg-carvao-suave/60"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-areia-escura/60 pt-5">
          <div>
            <p className="text-sm font-semibold text-carvao">
              Percentual do imposto
            </p>
            <p className="mt-0.5 max-w-md text-xs leading-relaxed text-carvao-suave">
              É uma estimativa para você se organizar, não uma apuração fiscal. Ajuste
              conforme o seu regime e confirme com sua contadora.
            </p>
          </div>
          <FormularioImposto percentual={usuario.impostoPercentual} />
        </div>
      </section>

      <GraficoPorDiaDaSemana dias={dias} />

      <section className="cartao animar-entrada">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Registrar um lançamento
        </h2>
        <p className="mt-1 text-sm text-carvao-suave">
          Aluguel, material, um produto vendido — tudo o que não passa pela agenda.
        </p>
        <div className="mt-5">
          <FormularioLancamento hoje={paraDataLocal(agora)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Lançamentos deste mês
        </h2>

        {lancamentosDoMes.length === 0 ? (
          <Vazio
            titulo="Nenhum lançamento ainda"
            texto="Assim que você registrar a primeira despesa ou entrada, ela aparece aqui."
          />
        ) : (
          <ul className="space-y-3">
            {lancamentosDoMes.map((lancamento) => {
              const entrada = lancamento.tipo === "entrada";

              return (
                <li
                  key={lancamento.id}
                  className="cartao flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-carvao">{lancamento.descricao}</p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      {dataCurta(lancamento.data)}
                      {lancamento.categoria ? ` · ${lancamento.categoria}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-display text-lg font-semibold tabular-nums ${
                        entrada ? "text-terracota" : "text-carvao"
                      }`}
                    >
                      {entrada ? "+" : "−"} {emReais(lancamento.valorCentavos)}
                    </span>
                    <form action={excluirLancamento}>
                      <input type="hidden" name="id" value={lancamento.id} />
                      <BotaoConfirmar
                        pergunta={`Apagar o lançamento "${lancamento.descricao}"?`}
                      >
                        Apagar
                      </BotaoConfirmar>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  children,
  tom,
  atraso,
}: {
  titulo: string;
  valor: string;
  children: React.ReactNode;
  tom: "boa" | "neutra" | "destaque" | "atencao";
  atraso: number;
}) {
  const cores = {
    boa: "text-terracota",
    neutra: "text-carvao",
    destaque: "text-terracota",
    atencao: "text-carvao",
  } as const;

  return (
    <div className="cartao animar-entrada" style={{ animationDelay: `${atraso}ms` }}>
      <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
        {titulo}
      </p>
      <p
        className={`mt-2 font-display text-2xl font-semibold tabular-nums ${cores[tom]}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-carvao-suave">{children}</p>
    </div>
  );
}

function LinhaDoResumo({
  rotulo,
  valor,
  maior,
  cor,
}: {
  rotulo: string;
  valor: number;
  maior: number;
  cor: string;
}) {
  const largura = Math.max((valor / maior) * 100, valor > 0 ? 2 : 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-carvao-suave">{rotulo}</p>
        <p className="text-sm font-semibold tabular-nums text-carvao">
          {emReais(valor)}
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-areia">
        <div
          className={`animar-largura h-full rounded-full ${cor}`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </div>
  );
}
