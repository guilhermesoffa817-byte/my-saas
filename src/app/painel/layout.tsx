import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { temFinanceiro } from "@/lib/assinatura";
import { primeiroNome } from "@/lib/formato";
import { sair } from "@/app/acoes/autenticacao";
import { Navegacao } from "./navegacao";
import { BotaoTema } from "@/componentes/tema";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);

  return (
    <div className="min-h-screen">
      <header className="border-b border-areia-escura/60 bg-superficie/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Marca href="/painel" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-carvao-suave sm:block">
              Oi, {primeiroNome(usuario.nome)}
            </span>
            <BotaoTema />
            <form action={sair}>
              <button type="submit" className="botao-suave px-4 py-2 text-xs">
                Sair
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-3">
          <Navegacao
            admin={usuario.papel === "admin"}
            financeiro={temFinanceiro(usuario.assinatura)}
          />
        </div>
      </header>

      {!situacao.liberada ? (
        <div className="bg-terracota/10 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <Link href="/painel/assinatura" className="font-semibold text-terracota hover:underline">
              Ver como pagar
            </Link>
          </div>
        </div>
      ) : situacao.emTeste ? (
        <div className="bg-areia/60 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <Link href="/painel/assinatura" className="font-semibold text-terracota hover:underline">
              Garantir meu mês
            </Link>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-sm text-carvao-suave">
        <p>
          {usuario.nomeNegocio} — qualquer dúvida, estamos aqui para ajudar.
        </p>
      </footer>
    </div>
  );
}
