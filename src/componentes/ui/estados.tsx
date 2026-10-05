/**
 * Os três estados que toda lista do Bossa precisa ter: carregando, vazia e com
 * erro. Antes cada tela resolvia isso do seu jeito, ou não resolvia.
 */

import Link from "next/link";

/** Esqueleto cinza que ocupa o lugar enquanto o servidor monta a lista. */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, posicao) => (
        <div
          key={posicao}
          className="h-20 animate-pulse rounded-2xl border border-areia-escura/60 bg-areia/50"
        />
      ))}
    </div>
  );
}

/**
 * Lista vazia. Nunca é só "nada aqui": diz qual é o próximo passo e, quando
 * faz sentido, leva até ele.
 */
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: { rotulo: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-areia-escura bg-areia/30 px-5 py-9 text-center">
      <p className="font-display text-lg text-carvao">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-carvao-suave">
        {texto}
      </p>
      {acao ? (
        <Link href={acao.href} className="botao mt-5">
          {acao.rotulo}
        </Link>
      ) : null}
    </div>
  );
}

/** Erro de carregamento, sempre com a saída: tentar de novo. */
export function Erro({
  titulo = "Não consegui carregar",
  texto = "Pode ter sido a internet. Tente de novo em um instante.",
  tentarDeNovo,
}: {
  titulo?: string;
  texto?: string;
  tentarDeNovo?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-300/70 bg-rose-50 px-5 py-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
      <p className="font-display text-lg text-rose-900 dark:text-rose-200">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-rose-800 dark:text-rose-300">
        {texto}
      </p>
      {tentarDeNovo ? (
        <button type="button" onClick={tentarDeNovo} className="botao-suave mt-5">
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}
