import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirLeituraDoRecurso } from "@/lib/guardas";
import { agoraDoPedido } from "@/lib/agora";
import { MES_FECHADO } from "@/lib/fechamento/trava";
import { Cartao, Indicador, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { Aviso, Etiqueta } from "@/componentes/ui/etiqueta";
import { BotaoConfirmar } from "@/componentes/ui/botao";
import {
  competenciaPorExtenso,
  dataPuraCurta,
  deDataPura,
  documentoBonito,
  emReais,
  hojeNoEstudio,
  paraDataPura,
  telefoneBonito,
} from "@/lib/formato";
import {
  PAGAMENTOS_POR_VINCULO,
  ROTULO_DA_AUSENCIA,
  ROTULO_DO_PAGAMENTO,
  SOBRE_O_VINCULO,
  alertasDaEquipe,
  centavosParaCampo,
  combinadoDoVinculo,
  competenciaValida,
  diasNoPeriodo,
  ehTipoDeAusencia,
  ehTipoDePagamento,
  ehVinculo,
  estaAtivo,
  limitesDoMes,
  pontosBaseParaTexto,
  resumirCombinado,
  somarMesesACompetencia,
  sugestaoDoColaborador,
  tipoDePagamentoSugerido,
  valorDoTipoDePagamento,
  type ColaboradorParaAlerta,
  type TipoDePagamento,
} from "@/lib/equipe";
import {
  ausenciasDoMes,
  basesDoMes,
  carregarEquipe,
  equipeDoMes,
  pagamentosDoMes,
  type ColaboradorDaTela,
} from "@/lib/equipe-operacoes";
import { FormularioDoColaborador, type CamposDoColaborador } from "./formulario-colaborador";
import { FormularioDeAusencia } from "./formulario-ausencia";
import { FormularioDePagamento } from "./formulario-pagamento";
import { Desligar, Remover } from "./acoes-da-pessoa";
import { excluirAusenciaAcao, excluirPagamentoAcao } from "./acoes";

export const metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

const ABAS = [
  { chave: "equipe", rotulo: "Equipe" },
  { chave: "ausencias", rotulo: "Ausências" },
  { chave: "pagamentos", rotulo: "Pagamentos" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

const AVISOS: Record<string, { tom: "boa" | "erro"; texto: string }> = {
  atualizado: { tom: "boa", texto: "Cadastro atualizado." },
  removido: {
    tom: "boa",
    texto: "Pessoa removida da equipe, com as ausências. Os horários que ela atendeu continuam na agenda.",
  },
  anonimizado: {
    tom: "boa",
    texto:
      "Pessoa removida. CPF, Pix, contato, observações e ausências foram apagados; os pagamentos continuam nas Finanças como “Ex-colaborador”, sem o nome.",
  },
  "nao-encontrado": { tom: "erro", texto: "Não encontramos essa pessoa na sua equipe." },
  "mes-fechado": { tom: "erro", texto: MES_FECHADO },
};

export default async function PaginaEquipe({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string; editar?: string; aviso?: string }>;
}) {
  const { usuario } = await exigirLeituraDoRecurso("equipe");
  const parametros = await searchParams;

  const hoje = paraDataPura(hojeNoEstudio(agoraDoPedido()));
  const aba: Aba = ABAS.some((item) => item.chave === parametros.aba)
    ? (parametros.aba as Aba)
    : "equipe";
  const mes = competenciaValida(parametros.mes) ? parametros.mes : hoje.slice(0, 7);
  const aviso = parametros.aviso ? AVISOS[parametros.aviso] : undefined;

  const equipe = await carregarEquipe(prisma, usuario.id);

  const alertas = alertasDaEquipe({
    // O Bossa não guarda o regime do negócio: o aviso do MEI vira lembrete.
    ehMei: null,
    hoje,
    colaboradores: equipe.map(
      (pessoa): ColaboradorParaAlerta => ({
        id: pessoa.id,
        nome: pessoa.nome,
        vinculo: pessoa.vinculo,
        inicio: pessoa.inicio,
        fim: pessoa.fim,
        removido: pessoa.removido,
      }),
    ),
  });

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="Sua equipe e o que você paga a cada um, num lugar só. A folha oficial continua com o seu contador.">
        Equipe
      </TituloDaTela>

      {aviso ? <Aviso tom={aviso.tom}>{aviso.texto}</Aviso> : null}

      {alertas.length > 0 ? (
        <div className="space-y-3">
          {alertas.map((alerta) => (
            <div
              key={alerta.chave}
              className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                alerta.nivel === "atencao"
                  ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
                  : "border-areia-escura bg-areia/40 text-carvao-suave"
              }`}
            >
              <p className="font-semibold text-carvao">{alerta.titulo}</p>
              <p className="mt-0.5">{alerta.texto}</p>
            </div>
          ))}
        </div>
      ) : null}

      <nav aria-label="Partes da equipe" className="flex gap-1 rounded-2xl bg-areia/60 p-1">
        {ABAS.map((item) => {
          const ativa = item.chave === aba;
          const href =
            item.chave === "equipe" ? "/painel/equipe" : `/painel/equipe?aba=${item.chave}&mes=${mes}`;
          return (
            <Link
              key={item.chave}
              href={href}
              aria-current={ativa ? "page" : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
                ativa ? "bg-superficie text-terracota shadow-sm" : "text-carvao-suave hover:text-carvao"
              }`}
            >
              {item.rotulo}
            </Link>
          );
        })}
      </nav>

      {aba === "equipe" ? (
        <AbaEquipe usuarioId={usuario.id} equipe={equipe} hoje={hoje} editar={parametros.editar} />
      ) : aba === "ausencias" ? (
        <AbaAusencias usuarioId={usuario.id} equipe={equipe} hoje={hoje} mes={mes} />
      ) : (
        <AbaPagamentos usuarioId={usuario.id} equipe={equipe} hoje={hoje} mes={mes} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Equipe
// ---------------------------------------------------------------------------

function situacao(pessoa: ColaboradorDaTela, hoje: string) {
  if (pessoa.removido) return { tom: "calma" as const, texto: "Removido" };
  if (pessoa.inicio > hoje) {
    return { tom: "espera" as const, texto: `Começa em ${dataPuraCurta(deDataPura(pessoa.inicio)!)}` };
  }
  if (estaAtivo(pessoa, hoje)) {
    return pessoa.fim
      ? { tom: "atencao" as const, texto: `Até ${dataPuraCurta(deDataPura(pessoa.fim)!)}` }
      : { tom: "boa" as const, texto: "Ativa" };
  }
  return { tom: "calma" as const, texto: `Saiu em ${dataPuraCurta(deDataPura(pessoa.fim!)!)}` };
}

async function AbaEquipe({
  usuarioId,
  equipe,
  hoje,
  editar,
}: {
  usuarioId: string;
  equipe: ColaboradorDaTela[];
  hoje: string;
  editar?: string;
}) {
  // Os dados pessoais só saem do banco quando a dona abre a edição de alguém.
  const emEdicao = editar
    ? await prisma.colaborador.findFirst({
        where: { id: editar, usuarioId, anonimizadoEm: null },
      })
    : null;

  const inicial: CamposDoColaborador | null =
    emEdicao && ehVinculo(emEdicao.vinculo)
      ? {
          id: emEdicao.id,
          nome: emEdicao.nome,
          cargo: emEdicao.cargo ?? "",
          vinculo: emEdicao.vinculo,
          inicio: paraDataPura(emEdicao.inicio),
          fim: emEdicao.fim ? paraDataPura(emEdicao.fim) : "",
          salario: centavosParaCampo(emEdicao.salarioCentavos),
          percentual:
            emEdicao.comissaoPontosBase > 0 ? pontosBaseParaTexto(emEdicao.comissaoPontosBase) : "",
          porAtendimento: centavosParaCampo(emEdicao.porAtendimentoCentavos),
          documento: emEdicao.documento ? documentoBonito(emEdicao.documento) : "",
          pixChave: emEdicao.pixChave ?? "",
          telefone: emEdicao.telefone ? telefoneBonito(emEdicao.telefone) : "",
          email: emEdicao.email ?? "",
          observacoes: emEdicao.observacoes ?? "",
        }
      : null;

  if (inicial) {
    return (
      <Secao titulo={`Editar ${inicial.nome}`}>
        <Cartao>
          <FormularioDoColaborador key={inicial.id} inicial={inicial} hoje={hoje} />
        </Cartao>
      </Secao>
    );
  }

  // Quem está trabalhando primeiro; depois quem saiu; removidos no fim.
  const ordem = (pessoa: ColaboradorDaTela) =>
    pessoa.removido ? 2 : pessoa.fim !== null && pessoa.fim < hoje ? 1 : 0;
  const lista = [...equipe].sort(
    (a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const ativas = equipe.filter((pessoa) => !pessoa.removido && estaAtivo(pessoa, hoje)).length;

  return (
    <div className="space-y-7">
      <Secao
        titulo="Quem trabalha com você"
        explicacao={
          equipe.length > 0
            ? `${ativas} ${ativas === 1 ? "pessoa trabalhando" : "pessoas trabalhando"} hoje. O vínculo e o combinado de cada uma ficam aqui.`
            : undefined
        }
      >
        {lista.length === 0 ? (
          <Vazio
            titulo="Ninguém na equipe ainda"
            texto="Cadastre abaixo quem trabalha com você para acompanhar ausências e pagamentos, e para escolher quem atende na agenda."
          />
        ) : (
          <ul className="space-y-3">
            {lista.map((pessoa) => {
              const estado = situacao(pessoa, hoje);
              const saiu = pessoa.fim !== null && pessoa.fim < hoje;
              return (
                <li key={pessoa.id}>
                  <Cartao className={pessoa.removido ? "opacity-70" : ""}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{pessoa.nome}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {SOBRE_O_VINCULO[pessoa.vinculo].curto}
                          {pessoa.cargo ? ` · ${pessoa.cargo}` : ""}
                        </p>
                        {!pessoa.removido ? (
                          <p className="mt-1 text-sm text-carvao">
                            {resumirCombinado(pessoa.vinculo, pessoa)}
                          </p>
                        ) : null}
                      </div>
                      <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
                    </div>

                    {pessoa.removido ? (
                      <p className="mt-3 text-xs leading-relaxed text-carvao-suave">
                        Sem dados pessoais. Os pagamentos ficam nas Finanças para o contador.
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-wrap items-start gap-2">
                        <Link href={`/painel/equipe?editar=${pessoa.id}`} className="botao-suave">
                          Editar
                        </Link>
                        {!saiu ? (
                          <Desligar
                            id={pessoa.id}
                            nome={pessoa.nome}
                            vinculo={pessoa.vinculo}
                            inicio={pessoa.inicio}
                            hoje={hoje}
                          />
                        ) : null}
                        <Remover id={pessoa.id} nome={pessoa.nome} />
                      </div>
                    )}
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Cadastrar alguém"
        explicacao="O cadastro serve para você acompanhar a equipe e o que paga a cada um. A folha oficial continua com o seu contador."
      >
        <Cartao>
          <FormularioDoColaborador inicial={null} hoje={hoje} />
        </Cartao>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seletor de mês, das abas Ausências e Pagamentos
// ---------------------------------------------------------------------------

function SeletorDeMes({ aba, mes, hoje }: { aba: Aba; mes: string; hoje: string }) {
  const anterior = somarMesesACompetencia(mes, -1);
  const seguinte = somarMesesACompetencia(mes, 1);
  const atual = hoje.slice(0, 7);

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/painel/equipe?aba=${aba}&mes=${anterior}`}
        className="botao-suave px-4"
        aria-label={`Ver ${competenciaPorExtenso(anterior)}`}
      >
        ‹
      </Link>
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-carvao">
          {competenciaPorExtenso(mes)}
        </p>
        {mes !== atual ? (
          <Link
            href={`/painel/equipe?aba=${aba}&mes=${atual}`}
            className="text-xs font-semibold text-terracota hover:underline"
          >
            Voltar para o mês atual
          </Link>
        ) : null}
      </div>
      <Link
        href={`/painel/equipe?aba=${aba}&mes=${seguinte}`}
        className="botao-suave px-4"
        aria-label={`Ver ${competenciaPorExtenso(seguinte)}`}
      >
        ›
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Ausências
// ---------------------------------------------------------------------------

async function AbaAusencias({
  usuarioId,
  equipe,
  hoje,
  mes,
}: {
  usuarioId: string;
  equipe: ColaboradorDaTela[];
  hoje: string;
  mes: string;
}) {
  const ausencias = await ausenciasDoMes(prisma, usuarioId, mes);
  const nomes = new Map(equipe.map((pessoa) => [pessoa.id, pessoa.nome]));
  const { de } = limitesDoMes(mes);
  const quemPode = equipe.filter(
    (pessoa) => !pessoa.removido && (pessoa.fim === null || pessoa.fim >= de),
  );

  return (
    <div className="space-y-7">
      <SeletorDeMes aba="ausencias" mes={mes} hoje={hoje} />

      <Secao
        titulo="Ausências do mês"
        explicacao="Férias, folgas, atestados e os dias em que alguém não atende. Na agenda, quem está ausente não pode ser escolhido para atender."
      >
        {ausencias.length === 0 ? (
          <Vazio
            titulo="Ninguém ausente neste mês"
            texto="Quando alguém tirar férias, folga ou ficar indisponível, registre abaixo."
          />
        ) : (
          <ul className="space-y-3">
            {ausencias.map((ausencia) => {
              const dias = diasNoPeriodo(ausencia.inicio, ausencia.fim);
              const nome = nomes.get(ausencia.colaboradorId) ?? "Alguém da equipe";
              const rotulo = ehTipoDeAusencia(ausencia.tipo)
                ? ROTULO_DA_AUSENCIA[ausencia.tipo]
                : ausencia.tipo;
              return (
                <li key={ausencia.id}>
                  <Cartao>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{nome}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {rotulo} ·{" "}
                          {ausencia.inicio === ausencia.fim
                            ? dataPuraCurta(deDataPura(ausencia.inicio)!)
                            : `${dataPuraCurta(deDataPura(ausencia.inicio)!)} a ${dataPuraCurta(deDataPura(ausencia.fim)!)}`}{" "}
                          · {dias} {dias === 1 ? "dia" : "dias"}
                        </p>
                      </div>
                      <form action={excluirAusenciaAcao}>
                        <input type="hidden" name="id" value={ausencia.id} />
                        <BotaoConfirmar
                          pergunta={`Apagar a ausência de ${nome}?`}
                          className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                        >
                          Apagar
                        </BotaoConfirmar>
                      </form>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao titulo="Registrar ausência">
        <Cartao>
          {quemPode.length === 0 ? (
            <Vazio
              titulo="Ninguém na equipe neste mês"
              texto="Cadastre a equipe primeiro, na aba Equipe."
              acao={{ rotulo: "Ir para a equipe", href: "/painel/equipe" }}
            />
          ) : (
            <FormularioDeAusencia
              pessoas={quemPode.map((pessoa) => ({
                id: pessoa.id,
                nome: pessoa.nome,
                vinculo: pessoa.vinculo,
              }))}
              dia={hoje.slice(0, 7) === mes ? hoje : de}
            />
          )}
        </Cartao>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Pagamentos
// ---------------------------------------------------------------------------

async function AbaPagamentos({
  usuarioId,
  equipe,
  hoje,
  mes,
}: {
  usuarioId: string;
  equipe: ColaboradorDaTela[];
  hoje: string;
  mes: string;
}) {
  const [bases, pagamentos] = await Promise.all([
    basesDoMes(prisma, usuarioId, mes),
    pagamentosDoMes(prisma, usuarioId, mes),
  ]);

  const doMes = equipeDoMes(equipe, mes);
  const nomes = new Map(equipe.map((pessoa) => [pessoa.id, pessoa.nome]));
  const pagoPorPessoa = new Map<string, number>();
  for (const pagamento of pagamentos) {
    pagoPorPessoa.set(
      pagamento.colaboradorId,
      (pagoPorPessoa.get(pagamento.colaboradorId) ?? 0) + pagamento.valorCentavos,
    );
  }

  const linhas = doMes.map((pessoa) => {
    const combinado = combinadoDoVinculo(pessoa.vinculo, pessoa);
    const base = bases[pessoa.id];
    const sugerido = sugestaoDoColaborador(pessoa, base);
    const tipos = PAGAMENTOS_POR_VINCULO[pessoa.vinculo];
    const valoresPorTipo = Object.fromEntries(
      tipos.map((tipo) => [tipo, valorDoTipoDePagamento(tipo, sugerido)]),
    ) as Partial<Record<TipoDePagamento, number>>;
    return { pessoa, combinado, base, sugerido, tipos, valoresPorTipo };
  });

  const totalSugerido = linhas.reduce((soma, linha) => soma + linha.sugerido.totalCentavos, 0);
  const totalPago = pagamentos.reduce((soma, pagamento) => soma + pagamento.valorCentavos, 0);
  const rotuloDoMes = competenciaPorExtenso(mes);

  return (
    <div className="space-y-7">
      <SeletorDeMes aba="pagamentos" mes={mes} hoje={hoje} />

      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <Indicador
          rotulo="Combinado do mês"
          valor={emReais(totalSugerido)}
          detalhe="a conta do que foi combinado"
        />
        <Indicador
          rotulo="Pago"
          valor={emReais(totalPago)}
          detalhe={`${pagamentos.length} ${pagamentos.length === 1 ? "pagamento" : "pagamentos"}`}
          tom="destaque"
          atraso={80}
        />
      </section>

      <Secao
        titulo="O combinado de cada um"
        explicacao="A sugestão é só a conta do combinado: valor fixo, mais o percentual sobre os atendimentos concluídos no mês, mais o valor por atendimento. Para CLT e estágio, registre o valor que o contador mandou: o Bossa não calcula salário líquido, descontos nem encargos."
      >
        {linhas.length === 0 ? (
          <Vazio
            titulo={equipe.length > 0 ? "Ninguém da equipe trabalhou neste mês" : "Ninguém na equipe ainda"}
            texto={
              equipe.length > 0
                ? "Escolha outro mês no seletor acima."
                : "Cadastre a equipe na aba Equipe para acompanhar os pagamentos."
            }
            acao={equipe.length > 0 ? undefined : { rotulo: "Ir para a equipe", href: "/painel/equipe" }}
          />
        ) : (
          <ul className="space-y-3">
            {linhas.map(({ pessoa, combinado, base, sugerido, tipos, valoresPorTipo }) => {
              const usaBase = combinado.comissaoPontosBase > 0 || combinado.porAtendimentoCentavos > 0;
              const pago = pagoPorPessoa.get(pessoa.id) ?? 0;
              return (
                <li key={pessoa.id}>
                  <Cartao>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{pessoa.nome}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {SOBRE_O_VINCULO[pessoa.vinculo].curto} ·{" "}
                          {resumirCombinado(pessoa.vinculo, combinado)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                          Sugerido
                        </p>
                        <p className="font-display text-lg font-semibold tabular-nums text-carvao">
                          {sugerido.totalCentavos > 0 ? emReais(sugerido.totalCentavos) : "—"}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                      {usaBase ? (
                        <>
                          <dt className="text-carvao-suave">Atendimentos concluídos</dt>
                          <dd className="text-right tabular-nums text-carvao sm:text-left">
                            {base?.atendimentos ?? 0}
                          </dd>
                          <dt className="text-carvao-suave sm:col-start-1">Valor desses atendimentos</dt>
                          <dd className="text-right tabular-nums text-carvao sm:text-left">
                            {emReais(base?.baseCentavos ?? 0)}
                          </dd>
                        </>
                      ) : null}
                      <dt className="text-carvao-suave sm:col-start-1">Pago neste mês</dt>
                      <dd className="text-right font-semibold tabular-nums text-carvao sm:text-left">
                        {emReais(pago)}
                      </dd>
                    </dl>

                    {usaBase && (base?.atendimentos ?? 0) === 0 ? (
                      <p className="mt-2 text-xs leading-relaxed text-carvao-suave">
                        A base vem dos horários concluídos em que {pessoa.nome.split(" ")[0]} aparece
                        em “Quem atende”, na agenda.
                      </p>
                    ) : null}

                    <div className="mt-4">
                      <FormularioDePagamento
                        pessoa={{ id: pessoa.id, nome: pessoa.nome, vinculo: pessoa.vinculo }}
                        tipos={tipos}
                        tipoSugerido={tipoDePagamentoSugerido(pessoa.vinculo, combinado)}
                        valoresPorTipo={valoresPorTipo}
                        competencia={mes}
                        rotuloDoMes={rotuloDoMes}
                        hoje={hoje}
                      />
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Pagamentos registrados"
        explicacao={`Referentes a ${rotuloDoMes.toLowerCase()}. Cada um já entrou nas Finanças como saída; para mudar, apague aqui e registre de novo.`}
      >
        {pagamentos.length === 0 ? (
          <Vazio
            titulo="Nenhum pagamento neste mês"
            texto="Quando você registrar um pagamento acima, ele aparece aqui e nas Finanças."
          />
        ) : (
          <ul className="space-y-3">
            {pagamentos.map((pagamento) => {
              const nome = nomes.get(pagamento.colaboradorId) ?? "Ex-colaborador";
              const rotulo = ehTipoDePagamento(pagamento.tipo)
                ? ROTULO_DO_PAGAMENTO[pagamento.tipo]
                : pagamento.tipo;
              return (
                <li key={pagamento.id}>
                  <Cartao>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{nome}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {rotulo} · pago em {dataPuraCurta(deDataPura(pagamento.pagoEm)!)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg font-semibold tabular-nums text-carvao">
                          − {emReais(pagamento.valorCentavos)}
                        </span>
                        <form action={excluirPagamentoAcao}>
                          <input type="hidden" name="id" value={pagamento.id} />
                          <BotaoConfirmar
                            pergunta={`Apagar este pagamento de ${nome}? A saída nas Finanças sai junto.`}
                            className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                          >
                            Apagar
                          </BotaoConfirmar>
                        </form>
                      </div>
                    </div>
                  </Cartao>
                </li>
              );
            })}
            <li className="flex items-center justify-between px-1 pt-1 text-sm">
              <span className="font-semibold text-carvao-suave">Total pago</span>
              <span className="font-display text-lg font-semibold tabular-nums text-carvao">
                {emReais(totalPago)}
              </span>
            </li>
          </ul>
        )}
      </Secao>
    </div>
  );
}
