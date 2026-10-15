import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { BotaoTema } from "@/componentes/tema";
import { Aviso } from "@/componentes/ui/etiqueta";
import { EMPRESA, aPreencher, whatsappDoBossa } from "@/lib/empresa";
import { dataPorExtenso } from "@/lib/formato";

/**
 * As peças das páginas legais: os Termos de uso e a Política de privacidade.
 *
 * As duas páginas têm o mesmo desenho e a mesma regra para os dados da
 * empresa, então ficam num lugar só. Texto legal é lido devagar, muitas vezes
 * no celular: coluna estreita, letra do tamanho normal e um título por assunto,
 * com âncora, para dar para mandar o link de um trecho só.
 */

export function PaginaLegal({
  titulo,
  atualizadaEm,
  resumo,
  outra,
  children,
}: {
  titulo: string;
  /** Data da última mudança no texto, no formato AAAA-MM-DD. */
  atualizadaEm: string;
  resumo: React.ReactNode;
  /** A outra página legal, para o link do pé. */
  outra: { href: string; rotulo: string };
  children: React.ReactNode;
}) {
  // Meio-dia em São Paulo: a data cai no mesmo dia em qualquer fuso do Brasil.
  const data = dataPorExtenso(new Date(`${atualizadaEm}T12:00:00-03:00`));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-6">
        <Marca />
        <BotaoTema />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-4 pb-16">
        {!EMPRESA.dadosCompletos ? (
          <div className="mb-8">
            <Aviso tom="atencao">
              Este texto ainda está sendo finalizado. Os trechos marcados com &ldquo;a
              preencher&rdquo; recebem os dados da empresa responsável pelo Bossa antes de
              valerem.
            </Aviso>
          </div>
        ) : null}

        <h1 className="font-display text-3xl font-semibold text-balance text-carvao md:text-4xl">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-carvao-suave">Última atualização: {data}</p>

        <div className="mt-6 leading-relaxed text-carvao-suave sm:text-lg">{resumo}</div>

        <div className="mt-10 space-y-10">{children}</div>

        <nav
          aria-label="Outras páginas"
          className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-areia-escura/60 pt-6 text-sm"
        >
          <Link href={outra.href} className="font-semibold text-terracota hover:underline">
            {outra.rotulo}
          </Link>
          <Link href="/" className="font-semibold text-carvao-suave hover:text-terracota">
            Voltar para o início
          </Link>
        </nav>
      </main>
    </div>
  );
}

/** Um assunto do texto, com título e âncora. */
export function Trecho({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6">
      <h2
        id={`${id}-titulo`}
        className="font-display text-xl font-semibold text-balance text-carvao"
      >
        <a href={`#${id}`} className="hover:text-terracota">
          {titulo}
        </a>
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-carvao-suave">{children}</div>
    </section>
  );
}

/** Lista com o mesmo marcador redondo da página inicial. */
export function Itens({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2">{children}</ul>;
}

export function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota" aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Destaque para o nome de algo que aparece na tela, como um botão. */
export function NaTela({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-carvao">{children}</strong>;
}

/**
 * Um dado da empresa, ou o aviso de que ele falta. O aviso tem borda tracejada
 * de propósito: um rascunho precisa parecer rascunho a um passar de olhos.
 */
export function Dado({ valor, falta }: { valor: string | null; falta: string }) {
  if (valor) return <span className="font-semibold text-carvao">{valor}</span>;
  return (
    <span className="rounded-md border border-dashed border-terracota bg-terracota/10 box-decoration-clone px-1.5 font-semibold text-terracota">
      {aPreencher(falta)}
    </span>
  );
}

/** Os canais de contato, com link quando existem. */
export function Contatos() {
  const whatsapp = whatsappDoBossa("Oi! Tenho uma dúvida sobre os termos ou a privacidade do Bossa.");

  return (
    <Itens>
      <Item>
        E-mail:{" "}
        {EMPRESA.email ? (
          <a
            href={`mailto:${EMPRESA.email}`}
            className="font-semibold wrap-anywhere text-terracota hover:underline"
          >
            {EMPRESA.email}
          </a>
        ) : (
          <Dado valor={null} falta="e-mail de contato" />
        )}
      </Item>
      <Item>
        WhatsApp:{" "}
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold whitespace-nowrap text-terracota hover:underline"
          >
            {EMPRESA.whatsapp}
          </a>
        ) : (
          <Dado valor={null} falta="WhatsApp de contato" />
        )}
      </Item>
    </Itens>
  );
}

/** "Bossa, oferecido por Fulano Ltda, CNPJ 00.000.000/0001-00". */
export function QuemResponde() {
  return (
    <>
      <Dado valor={EMPRESA.nome} falta="nome da empresa" />,{" "}
      {EMPRESA.tipoDoDocumento ? `${EMPRESA.tipoDoDocumento} ` : null}
      <Dado valor={EMPRESA.documento} falta="CPF ou CNPJ" />
    </>
  );
}
