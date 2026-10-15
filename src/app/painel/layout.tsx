import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { temFinanceiro } from "@/lib/assinatura";
import { primeiroNome } from "@/lib/formato";
import { NOME_DO_PRODUTO } from "@/lib/site";
import { BarraDeBaixo, MenuDaConta, NavegacaoLarga } from "./navegacao";
import { BotaoTema } from "@/componentes/tema";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);
  const admin = usuario.papel === "admin";
  const financeiro = temFinanceiro(usuario.assinatura);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-areia-escura/60 bg-superficie/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Marca href="/painel" />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden truncate text-sm text-carvao-suave sm:block md:hidden">
              Oi, {primeiroNome(usuario.nome)}
            </span>
            <BotaoTema />
            {/* No celular, conta, assinatura e "Sair" moram dentro de "Mais",
                para a barra do topo não competir com a ação principal da tela. */}
            <div className="hidden md:block">
              <MenuDaConta
                nome={primeiroNome(usuario.nome)}
                admin={admin}
                financeiro={financeiro}
              />
            </div>
          </div>
        </div>
        <div className="mx-auto hidden max-w-6xl px-5 pb-3 md:block">
          <NavegacaoLarga admin={admin} financeiro={financeiro} />
        </div>
      </header>

      {!situacao.liberada ? (
        <div className="bg-terracota/10 text-carvao">
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
        <div className="bg-areia/60 text-carvao">
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

      {/* Assinado pelo Bossa, e não pelo estúdio: quem está "aqui para ajudar"
          é a equipe do Bossa. No celular, os mesmos links ficam no fim do "Mais". */}
      <footer className="mx-auto hidden max-w-6xl px-5 pb-10 text-sm text-carvao-suave md:block">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-areia-escura/60 pt-6">
          <p>{NOME_DO_PRODUTO} · qualquer dúvida, a nossa equipe está aqui para ajudar.</p>
          <nav aria-label="Documentos do Bossa" className="flex gap-5">
            <Link href="/privacidade" className="hover:text-terracota hover:underline">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-terracota hover:underline">
              Termos de uso
            </Link>
          </nav>
        </div>
      </footer>

      {/* A barra de baixo fica fora do <main> para não rolar com o conteúdo. */}
      <BarraDeBaixo admin={admin} financeiro={financeiro} />
    </div>
  );
}
