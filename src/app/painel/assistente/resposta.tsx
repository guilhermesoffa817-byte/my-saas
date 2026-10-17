import { interpretarMarkdown, type Trecho } from "@/lib/assistente/markdown";
import type { FonteDaResposta } from "@/lib/assistente/protocolo";

/**
 * A resposta do assistente, montada como elementos do React a partir de um
 * markdown simples. Nada de dangerouslySetInnerHTML: todo texto vindo do
 * modelo (e, por tabela, das páginas que ele leu na web) é escapado pelo React.
 */

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return trechos.map((t, i) => {
    if (t.tipo === "negrito") return <strong key={i} className="font-semibold text-carvao">{t.texto}</strong>;
    if (t.tipo === "link") {
      return (
        <a
          key={i}
          href={t.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-terracota underline underline-offset-2"
        >
          {t.texto}
        </a>
      );
    }
    return <span key={i}>{t.texto}</span>;
  });
}

export function TextoDaResposta({ texto }: { texto: string }) {
  const blocos = interpretarMarkdown(texto);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocos.map((bloco, i) => {
        if (bloco.tipo === "titulo") {
          return (
            <p key={i} className="font-display font-semibold text-carvao">
              <Trechos trechos={bloco.trechos} />
            </p>
          );
        }
        if (bloco.tipo === "lista") {
          const Lista = bloco.ordenada ? "ol" : "ul";
          return (
            <Lista key={i} className={`space-y-1 pl-5 ${bloco.ordenada ? "list-decimal" : "list-disc"}`}>
              {bloco.itens.map((item, j) => (
                <li key={j}>
                  <Trechos trechos={item} />
                </li>
              ))}
            </Lista>
          );
        }
        return (
          <p key={i}>
            <Trechos trechos={bloco.trechos} />
          </p>
        );
      })}
    </div>
  );
}

function nomeDoSite(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function FontesDaResposta({ fontes }: { fontes: FonteDaResposta[] }) {
  if (fontes.length === 0) return null;
  return (
    <div className="mt-4 border-t border-areia-escura/70 pt-3">
      <p className="text-xs font-semibold text-carvao-suave">Fontes consultadas na internet</p>
      <ul className="mt-2 space-y-1.5">
        {fontes.map((fonte) => (
          <li key={fonte.url} className="text-xs">
            <a
              href={fonte.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-words text-terracota underline underline-offset-2"
            >
              {fonte.titulo || nomeDoSite(fonte.url)}
              <span className="text-carvao-suave"> ({nomeDoSite(fonte.url)})</span>
              <span className="sr-only"> (abre em outra aba)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-carvao-suave">Tendência de mercado não garante resultado.</p>
    </div>
  );
}
