import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { dataEHora } from "@/lib/formato";
import { acessoAtual, ultimoRevogado } from "@/lib/contador/operacoes";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { GerarLink, RevogarLink } from "./formulario";

export const metadata = { title: "Acesso do contador" };
export const dynamic = "force-dynamic";

export default async function PaginaContador() {
  const { usuario } = await exigirRecurso("financas");
  const [ativo, revogado] = await Promise.all([
    acessoAtual(prisma, usuario.id),
    ultimoRevogado(prisma, usuario.id),
  ]);

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="Um link secreto, só de leitura, para o seu contador ver os relatórios do mês e baixar as planilhas. Ele não precisa de senha nem de conta no Bossa.">
        Acesso do contador
      </TituloDaTela>

      <Cartao destaque={Boolean(ativo)}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-semibold text-carvao">Link do contador</p>
          <Etiqueta tom={ativo ? "boa" : "calma"}>{ativo ? "Ligado" : "Desligado"}</Etiqueta>
        </div>

        {ativo ? (
          <ul className="mt-3 space-y-1 text-sm text-carvao-suave">
            <li>Criado em {dataEHora(ativo.criadoEm)}.</li>
            <li>
              {ativo.ultimoAcessoEm
                ? `Último acesso em ${dataEHora(ativo.ultimoAcessoEm)}.`
                : "O contador ainda não abriu este link."}
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-carvao-suave">
            Nenhum link ligado agora.
            {revogado?.ultimoAcessoEm
              ? ` O link anterior foi aberto pela última vez em ${dataEHora(revogado.ultimoAcessoEm)}.`
              : ""}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <GerarLink temLink={Boolean(ativo)} />
          </div>
          {ativo ? <RevogarLink /> : null}
        </div>
      </Cartao>

      <Secao titulo="O que o contador vê">
        <Cartao>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-suave">
            <li>Os relatórios dos últimos doze meses, com a marca de fechado ou em aberto.</li>
            <li>Totais de entradas, saídas, pagamentos à equipe, contas e cobranças.</li>
            <li>Os downloads em Excel e CSV, e a versão para imprimir ou salvar em PDF.</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-carvao-suave">
            Ele <strong className="text-carvao">não vê</strong> nome, telefone ou CPF dos seus
            clientes, nem dados pessoais da equipe, e não consegue mudar nada. Para ele ver
            números definitivos, feche o mês no{" "}
            <Link href="/painel/financas/relatorio" className="font-semibold text-terracota">
              relatório
            </Link>
            .
          </p>
          <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
            Quem tiver o link consegue abrir. Mande só para o seu contador e, se ele trocar de
            escritório ou o link vazar, gere outro: o antigo para na hora.
          </p>
        </Cartao>
      </Secao>
    </div>
  );
}
