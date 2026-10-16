import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { competenciaPorExtenso } from "@/lib/formato";
import { NOME_DO_PRODUTO } from "@/lib/site";
import {
  fechamentosDosMeses,
  mesDoPedido,
  relatorioDoMes,
  ultimosMeses,
} from "@/lib/relatorio/operacoes";
import { situacaoPorExtenso } from "@/lib/relatorio/arquivo";
import { RelatorioNaTela } from "@/componentes/relatorio-do-mes";
import { BotaoImprimir } from "@/componentes/ui/imprimir";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { abrirComCodigo } from "./abrir";

export const dynamic = "force-dynamic";

// Página feita para uma pessoa só, o contador: nada aqui é para o Google.
export const metadata: Metadata = {
  title: "Relatórios para o contador",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function Moldura({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>;
}

/**
 * O que o contador vê pelo link secreto: os doze últimos meses e o relatório
 * do mês escolhido, só leitura. Nenhum formulário, nenhuma ação que grave.
 */
export default async function PaginaDoContador({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { codigo } = await params;
  const abertura = await abrirComCodigo(codigo);

  if (abertura.situacao === "nao_encontrado") notFound();

  if (abertura.situacao === "bloqueado") {
    return (
      <Moldura>
        <h1 className="font-display text-2xl font-semibold text-carvao">Muitas tentativas</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-carvao-suave">
          Este endereço recebeu muitos links errados em pouco tempo. Espere uma hora e tente de
          novo com o link que o estúdio enviou.
        </p>
      </Moldura>
    );
  }

  if (abertura.situacao === "indisponivel") {
    return (
      <Moldura>
        <h1 className="font-display text-2xl font-semibold text-carvao">
          Relatórios indisponíveis no momento
        </h1>
        <p className="mt-2 max-w-lg leading-relaxed text-carvao-suave">
          Fale com o estúdio para saber quando voltam.
        </p>
      </Moldura>
    );
  }

  const agora = new Date();
  const { mes: pedido } = await searchParams;
  const mes = mesDoPedido(pedido, agora);
  const meses = ultimosMeses(agora, 12);
  const [fechamentos, { relatorio, fechamento }] = await Promise.all([
    fechamentosDosMeses(prisma, abertura.usuarioId, meses),
    relatorioDoMes(prisma, abertura.usuarioId, mes, agora),
  ]);
  const base = `/contador/${codigo}`;

  return (
    <Moldura>
      <div className="nao-imprimir space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
            {NOME_DO_PRODUTO} · acesso do contador
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-carvao sm:text-3xl">
            {abertura.nomeNegocio}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-carvao-suave">
            Relatórios mensais, só para leitura. Mês fechado mostra o que o estúdio conferiu e
            fechou; mês em aberto ainda pode mudar.
          </p>
        </header>

        <nav aria-label="Meses">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {meses.map((item) => {
              const fechado = fechamentos.get(item)?.fechado;
              const ativo = item === mes;
              return (
                <li key={item} className="shrink-0">
                  <Link
                    href={`${base}?mes=${item}`}
                    aria-current={ativo ? "page" : undefined}
                    className={`flex flex-col rounded-xl border px-3 py-2 text-sm transition ${
                      ativo
                        ? "border-terracota bg-terracota/10 text-carvao"
                        : "border-areia-escura text-carvao-suave hover:border-terracota/60"
                    }`}
                  >
                    <span className="font-semibold">{competenciaPorExtenso(item)}</span>
                    <span className="text-xs">{fechado ? "Fechado" : "Em aberto"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tom={fechamento?.fechado ? "boa" : "espera"}>
            {fechamento?.fechado ? "Mês fechado" : "Mês em aberto"}
          </Etiqueta>
          <a href={`${base}/baixar?mes=${mes}&formato=xlsx`} className="botao-suave" download>
            Baixar Excel
          </a>
          <a href={`${base}/baixar?mes=${mes}&formato=csv`} className="botao-suave" download>
            Baixar CSV
          </a>
          <BotaoImprimir />
        </div>
      </div>

      <div className="mt-6">
        <RelatorioNaTela
          relatorio={relatorio}
          nomeNegocio={abertura.nomeNegocio}
          situacao={situacaoPorExtenso(fechamento)}
        />
      </div>
    </Moldura>
  );
}
