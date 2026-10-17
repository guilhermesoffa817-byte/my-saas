import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { RECADO_DA_DEMONSTRACAO } from "@/lib/assinatura";
import { recursosLigados, recursosLiberados } from "@/lib/recursos";
import { DESTINO_DA_DEMONSTRACAO } from "@/lib/demonstracao/conta";
import { primeiroNome } from "@/lib/formato";
import { sair } from "@/app/acoes/autenticacao";
import { BarraDeBaixo, NavegacaoLarga } from "./navegacao";
import { BotaoTema } from "@/componentes/tema";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);
  // Na demonstração o estúdio de exemplo é Completo: todas as abas aparecem.
  const liberados = situacao.demonstracao ? recursosLigados() : recursosLiberados(usuario);

  return (
    <div className="min-h-screen">
      <header className="nao-imprimir sticky top-0 z-30 border-b border-areia-escura/60 bg-superficie/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Marca href="/painel" />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-carvao-suave sm:block">
              Oi, {primeiroNome(usuario.nome)}
            </span>
            <BotaoTema />
            {/* No celular, "Sair" mora dentro de "Mais", para a barra do topo
                não competir com a ação principal da tela. */}
            <form action={sair} className="hidden md:block">
              <button type="submit" className="botao-suave px-4 py-2 text-xs">
                Sair
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto hidden max-w-6xl px-5 pb-3 md:block">
          <NavegacaoLarga
            admin={usuario.papel === "admin"}
            liberados={liberados}
          />
        </div>
        {situacao.demonstracao ? (
          /* Dentro do cabeçalho fixo: a faixa fica no topo durante toda a demonstração. */
          <div role="status" className="border-t border-terracota/30 bg-terracota text-acento-texto">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 leading-snug">
                {RECADO_DA_DEMONSTRACAO}
                {situacao.status === "aguardando"
                  ? " Já recebemos o aviso do seu Pix: assim que conferirmos, o painel passa a ser seu."
                  : ""}
              </span>
              <Link
                href={DESTINO_DA_DEMONSTRACAO}
                className="shrink-0 rounded-full bg-superficie px-4 py-1.5 text-xs font-semibold text-terracota transition hover:opacity-90"
              >
                Escolher um plano
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {!situacao.demonstracao && !situacao.liberada ? (
        <div className="nao-imprimir bg-terracota/10 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <Link
              href="/painel/assinatura"
              className="font-semibold text-terracota hover:underline"
            >
              Ver como pagar
            </Link>
          </div>
        </div>
      ) : situacao.emTeste ? (
        <div className="nao-imprimir bg-areia/60 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <Link
              href="/painel/assinatura"
              className="font-semibold text-terracota hover:underline"
            >
              Garantir meu mês
            </Link>
          </div>
        </div>
      ) : null}

      {/* A folga embaixo é o espaço da barra de navegação do celular. */}
      <main className="mx-auto max-w-6xl px-5 pt-6 pb-28 md:pt-8 md:pb-10">{children}</main>

      <footer className="nao-imprimir mx-auto hidden max-w-6xl px-5 pb-10 text-sm text-carvao-suave md:block">
        <p>{usuario.nomeNegocio} · qualquer dúvida, estamos aqui para ajudar.</p>
      </footer>

      {/* A barra de baixo fica fora do <main> para não rolar com o conteúdo. */}
      <BarraDeBaixo admin={usuario.papel === "admin"} liberados={liberados} />
    </div>
  );
}
