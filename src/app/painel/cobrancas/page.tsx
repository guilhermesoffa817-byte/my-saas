import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { Cartao, Indicador, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { Aviso, Etiqueta, ROTULO_DA_COBRANCA, TOM_DA_COBRANCA } from "@/componentes/ui/etiqueta";
import { dataPuraCurta, emReais, hojeNoEstudio } from "@/lib/formato";
import {
  lembreteDeHoje,
  prazoPorExtenso,
  situacaoDaCobranca,
  type CodigoDoMomento,
  type PreferenciaDeLembrete,
} from "@/lib/cobranca";

export const metadata = { title: "Cobranças" };
export const dynamic = "force-dynamic";

export default async function PaginaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { usuario } = await exigirRecurso("cobrar");
  const { ver } = await searchParams;
  const mostrarPagas = ver === "pagas";

  const cobrancas = await prisma.cobranca.findMany({
    where: {
      usuarioId: usuario.id,
      situacao: mostrarPagas ? { in: ["paga", "cancelada"] } : "aberta",
    },
    orderBy: mostrarPagas ? { pagaEm: "desc" } : { vencimento: "asc" },
    take: 100,
    select: {
      id: true,
      valorCentavos: true,
      vencimento: true,
      situacao: true,
      pagaEm: true,
      cliente: { select: { nome: true, semLembretes: true } },
      lembretes: { select: { momento: true } },
    },
  });

  const hoje = hojeNoEstudio();
  const temLembretes = podeUsar(usuario, "lembretes");

  const preferencias: PreferenciaDeLembrete = {
    antes: usuario.lembreteAntes,
    no_dia: usuario.lembreteNoDia,
    tres_dias: usuario.lembreteTresDias,
    sete_dias: usuario.lembreteSeteDias,
  };

  const comSituacao = cobrancas.map((cobranca) => ({
    ...cobranca,
    naTela: situacaoDaCobranca(cobranca, hoje),
  }));

  /*
    Nenhuma tarefa roda por trás para montar esta lista: ela sai das datas, aqui,
    na hora em que a tela abre. Cobrança com mais de um momento vencido aparece
    uma vez só, porque `lembreteDeHoje` devolve um momento, não vários.
  */
  const paraLembrar = temLembretes
    ? comSituacao.filter(
        (cobranca) =>
          !cobranca.cliente.semLembretes &&
          lembreteDeHoje({
            vencimento: cobranca.vencimento,
            hoje,
            preferencias,
            jaEnviados: cobranca.lembretes.map((item) => item.momento as CodigoDoMomento),
          }) !== null,
      )
    : [];

  const aReceber = comSituacao
    .filter((c) => c.situacao === "aberta")
    .reduce((soma, c) => soma + c.valorCentavos, 0);
  const atrasado = comSituacao
    .filter((c) => c.naTela === "atrasada")
    .reduce((soma, c) => soma + c.valorCentavos, 0);

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="O que você tem a receber dos seus clientes.">
        Cobranças
      </TituloDaTela>

      {!mostrarPagas ? (
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          <Indicador
            rotulo="A receber"
            valor={emReais(aReceber)}
            detalhe={`${comSituacao.length} em aberto`}
            tom="destaque"
          />
          <Indicador
            rotulo="Atrasado"
            valor={emReais(atrasado)}
            detalhe={
              comSituacao.filter((c) => c.naTela === "atrasada").length === 1
                ? "1 passou da data"
                : `${comSituacao.filter((c) => c.naTela === "atrasada").length} passaram da data`
            }
            tom={atrasado > 0 ? "atencao" : "neutro"}
            atraso={80}
          />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/painel/cobrancas/nova" className="botao">
          Nova cobrança
        </Link>
        <Link
          href={mostrarPagas ? "/painel/cobrancas" : "/painel/cobrancas?ver=pagas"}
          className="botao-suave"
        >
          {mostrarPagas ? "Ver as em aberto" : "Ver as já resolvidas"}
        </Link>
        <Link href="/painel/cobrancas/ajustes" className="botao-suave">
          Ajustes
        </Link>
      </div>

      {!temLembretes ? (
        <Aviso tom="calma">
          Os lembretes programados fazem parte do plano VIP. Cobrar pelo WhatsApp
          você já faz no seu plano.{" "}
          <Link href="/painel/assinatura?vip=1" className="font-semibold underline">
            Conhecer o VIP
          </Link>
        </Aviso>
      ) : null}

      {paraLembrar.length > 0 ? (
        <Secao
          titulo="Para lembrar hoje"
          explicacao="Pelas datas, chegou a hora de avisar essas pessoas."
        >
          <ul className="space-y-3">
            {paraLembrar.map((cobranca) => (
              <li key={cobranca.id}>
                <LinhaDaCobranca cobranca={cobranca} hoje={hoje} destaque />
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao titulo={mostrarPagas ? "Resolvidas" : "Em aberto"}>
        {comSituacao.length === 0 ? (
          <Vazio
            titulo={mostrarPagas ? "Nada resolvido ainda" : "Nenhuma cobrança em aberto"}
            texto={
              mostrarPagas
                ? "Quando você marcar uma cobrança como paga, ela aparece aqui."
                : "Cobre pelo horário na agenda, pela ficha do cliente ou no botão acima."
            }
            acao={mostrarPagas ? undefined : { rotulo: "Nova cobrança", href: "/painel/cobrancas/nova" }}
          />
        ) : (
          <ul className="space-y-3">
            {comSituacao.map((cobranca) => (
              <li key={cobranca.id}>
                <LinhaDaCobranca cobranca={cobranca} hoje={hoje} />
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

type CobrancaNaLista = {
  id: string;
  valorCentavos: number;
  vencimento: Date;
  pagaEm: Date | null;
  naTela: string;
  cliente: { nome: string };
};

function LinhaDaCobranca({
  cobranca,
  hoje,
  destaque = false,
}: {
  cobranca: CobrancaNaLista;
  hoje: Date;
  destaque?: boolean;
}) {
  return (
    <Link href={`/painel/cobrancas/${cobranca.id}`} className="block">
      <Cartao destaque={destaque} className="transition hover:border-terracota/50">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-carvao">{cobranca.cliente.nome}</p>
            <p className="mt-0.5 text-sm text-carvao-suave">
              {cobranca.naTela === "paga" && cobranca.pagaEm
                ? `Paga em ${dataPuraCurta(cobranca.pagaEm)}`
                : `${prazoPorExtenso(cobranca.vencimento, hoje)} · ${dataPuraCurta(cobranca.vencimento)}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold tabular-nums text-carvao">
              {emReais(cobranca.valorCentavos)}
            </p>
            <div className="mt-1">
              <Etiqueta tom={TOM_DA_COBRANCA[cobranca.naTela]}>
                {ROTULO_DA_COBRANCA[cobranca.naTela]}
              </Etiqueta>
            </div>
          </div>
        </div>
      </Cartao>
    </Link>
  );
}
