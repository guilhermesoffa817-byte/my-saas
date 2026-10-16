"use client";

/**
 * Abre a janela de impressão do navegador. Dali a pessoa imprime ou escolhe
 * "Salvar como PDF": é o PDF do relatório, sem biblioteca pesada no servidor.
 * As regras do papel (sem menu, fundo branco, sem cortar tabela) estão no
 * globals.css, em @media print.
 */
export function BotaoImprimir({ children = "Imprimir ou salvar em PDF" }: { children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className="botao-suave">
      {children}
    </button>
  );
}
