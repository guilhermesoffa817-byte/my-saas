import { Medicao } from "@/componentes/medicao";
import { idsDeMedicao, medicaoLigada } from "@/lib/medicao";

/**
 * Google Analytics, Meta Pixel e Clarity: só aparecem com o código na Netlify.
 * Fica num arquivo do servidor para o layout raiz não importar nada direto de
 * um arquivo "use client" (ver o teste "tema" em app/vitrine.teste.tsx).
 */
export function MedicaoDoSite() {
  const ids = idsDeMedicao();
  return medicaoLigada(ids) ? <Medicao ids={ids} /> : null;
}
