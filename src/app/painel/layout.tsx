import { Marca } from "@/componentes/marca";
import { LinksDeContato } from "@/componentes/contato";
import { estudioDaDemonstracao, exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { RECADO_DA_DEMONSTRACAO } from "@/lib/assinatura";
import { canaisDeContato } from "@/lib/contato";
import { recursosLigados, recursosLiberados } from "@/lib/recursos";
import { primeiroNome } from "@/lib/formato";
import { sair } from "@/app/acoes/autenticacao";
import { BarraDeBaixo, NavegacaoLarga } from "./navegacao";
import { LinkDaFaixa } from "./faixa";
import { BotaoTema } from "@/componentes/tema";

const NAO_LOCALIZADO = "Não localizamos o seu último Pix. Confira o comprovante e avise de novo.";

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);
  // Na demonstração o estúdio de exemplo é Completo: todas as abas aparecem.
  const liberados = situacao.demonstracao ? recursosLigados() : recursosLiberados(usuario);
  /*
    Na demonstração as telas mostram o estúdio de exemplo (outra dona, outro
    nome de estúdio). O topo e o rodapé dizem o mesmo, para a pessoa não ver o
    nome dela ao lado dos dados de outra.
  */
  const exemplo = situacao.demonstracao ? await estudioDaDemonstracao() : null;
  const temContato = canaisDeContato().length > 0;

  // A faixa da demonstração: uma linha curta no celular, a frase inteira do tablet para cima.
  const faixaCurta =
    situacao.status === "aguardando"
      ? "Exemplo · Pix em conferência"
      : situacao.pixNaoLocalizado
        ? "Exemplo · Pix não localizado"
        : "Você está vendo um exemplo";
  const faixaLonga = `${RECADO_DA_DEMONSTRACAO}${
    situacao.status === "aguardando"
      ? " Já recebemos o aviso do seu Pix: assim que conferirmos, o painel passa a ser seu."
      : situacao.pixNaoLocalizado
        ? ` ${NAO_LOCALIZADO}`
        : ""
  }`;

  return (
    <div className="min-h-screen">
      <header className="nao-imprimir sticky top-0 z-30 border-b border-areia-escura/60 bg-superficie/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Marca href="/painel" />
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-carvao-suave sm:block">
              {exemplo ? `Exemplo: ${exemplo.nomeNegocio}` : `Oi, ${primeiroNome(usuario.nome)}`}
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
          /*
            Dentro do cabeçalho fixo: a faixa fica no topo durante toda a
            demonstração. No celular é uma linha só, para não cobrir a tela.
            O link vai para a assinatura sem o recado de "ação bloqueada",
            que é só para quem tentou fazer alguma coisa.
          */
          <div role="status" className="border-t border-terracota/30 bg-terracota text-acento-texto">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2 text-sm sm:gap-4 sm:py-2.5">
              <span className="min-w-0 flex-1 truncate leading-snug sm:whitespace-normal">
                <span className="sm:hidden">{faixaCurta}</span>
                <span className="hidden sm:inline">{faixaLonga}</span>
              </span>
              <LinkDaFaixa
                href="/painel/assinatura"
                className="shrink-0 rounded-full bg-superficie px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-terracota transition hover:opacity-90 motion-reduce:transition-none sm:px-4"
              >
                <span className="sm:hidden">Escolher plano</span>
                <span className="hidden sm:inline">Escolher um plano</span>
              </LinkDaFaixa>
            </div>
          </div>
        ) : null}
      </header>

      {!situacao.demonstracao && !situacao.liberada ? (
        <div className="nao-imprimir bg-terracota/10 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.pixNaoLocalizado ? NAO_LOCALIZADO : situacao.recado}</span>
            <LinkDaFaixa
              href="/painel/assinatura"
              className="font-semibold text-terracota hover:underline"
            >
              Ver como pagar
            </LinkDaFaixa>
          </div>
        </div>
      ) : situacao.venceLogo ? (
        /* Faltam cinco dias ou menos: o Pix é feito à mão, então o painel avisa antes. */
        <div className="nao-imprimir bg-areia/60 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <LinkDaFaixa
              href="/painel/assinatura"
              className="font-semibold text-terracota hover:underline"
            >
              Ver como pagar
            </LinkDaFaixa>
          </div>
        </div>
      ) : situacao.emTeste ? (
        <div className="nao-imprimir bg-areia/60 text-carvao">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>{situacao.recado}</span>
            <LinkDaFaixa
              href="/painel/assinatura"
              className="font-semibold text-terracota hover:underline"
            >
              Garantir meu mês
            </LinkDaFaixa>
          </div>
        </div>
      ) : null}

      {/* A folga embaixo é o espaço da barra de navegação do celular. */}
      <main className="mx-auto max-w-6xl px-5 pt-6 pb-28 md:pt-8 md:pb-10">{children}</main>

      <footer className="nao-imprimir mx-auto hidden max-w-6xl px-5 pb-10 text-sm text-carvao-suave md:block">
        <p>
          {exemplo
            ? `${exemplo.nomeNegocio} é um estúdio de exemplo, com dados inventados.`
            : usuario.nomeNegocio}
          {/* Só promete conversa quando existe um canal de verdade. */}
          {temContato ? (
            <>
              {" "}· Dúvidas? Fale com a gente: <LinksDeContato />
            </>
          ) : null}
        </p>
      </footer>

      {/* A barra de baixo fica fora do <main> para não rolar com o conteúdo. */}
      <BarraDeBaixo admin={usuario.papel === "admin"} liberados={liberados} />
    </div>
  );
}
