import { Cabecalho } from "@/componentes/raissa/cabecalho";
import { Automatiza } from "@/componentes/raissa/secoes/automatiza";
import { ChamadaFinal } from "@/componentes/raissa/secoes/chamada-final";
import { Demonstracao } from "@/componentes/raissa/secoes/demonstracao";
import { Hero } from "@/componentes/raissa/secoes/hero";
import { Integracao } from "@/componentes/raissa/secoes/integracao";
import { Planos } from "@/componentes/raissa/secoes/planos";
import { Rodape } from "@/componentes/raissa/secoes/rodape";

export default function PaginaRaissaSoffa() {
  return (
    <>
      <Cabecalho />
      <main>
        <Hero />
        <Automatiza />
        <Integracao />
        <Demonstracao />
        <Planos />
        <ChamadaFinal />
      </main>
      <Rodape />
    </>
  );
}
