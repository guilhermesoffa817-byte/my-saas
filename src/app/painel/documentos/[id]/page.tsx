import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { dataPuraCurta, emReais, paraDataPura } from "@/lib/formato";
import { Item, type ItemNaTela } from "../item";
import { encerrarConferencia } from "../acoes";

export const metadata = { title: "Conferir documento" };
export const dynamic = "force-dynamic";

export default async function PaginaDoDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { usuario } = await exigirRecurso("documentos");
  const { id } = await params;

  // O estúdio da sessão entra na busca: documento de outro estúdio não existe
  // para quem perguntou.
  const documento = await prisma.documento.findFirst({
    where: { id, usuarioId: usuario.id },
    select: {
      id: true,
      nome: true,
      situacao: true,
      tipoDeDocumento: true,
      partes: true,
      resumo: true,
      fimDoContrato: true,
      reajusteEm: true,
      indiceDeReajuste: true,
      multa: true,
      avisoPrevio: true,
      itens: { orderBy: [{ duvidoso: "desc" }, { data: "asc" }] },
    },
  });

  if (!documento) notFound();

  const itens: ItemNaTela[] = documento.itens.map((item) => ({
    id: item.id,
    descricao: item.descricao,
    tipo: item.tipo,
    valor: item.valorCentavos ? (item.valorCentavos / 100).toFixed(2).replace(".", ",") : "",
    data: item.data ? paraDataPura(item.data) : "",
    dataBonita: item.data ? dataPuraCurta(item.data) : "",
    valorBonito: item.valorCentavos ? emReais(item.valorCentavos) : "",
    repeticao: item.repeticao,
    repeteAte: item.repeteAte ? dataPuraCurta(item.repeteAte) : null,
    trecho: item.trecho,
    pagina: item.pagina,
    duvidoso: item.duvidoso,
    decisao: item.decisao,
  }));

  const pendentes = itens.filter((item) => !item.decisao);
  const prazos = [
    documento.fimDoContrato
      ? { rotulo: "Fim do contrato", valor: dataPuraCurta(documento.fimDoContrato) }
      : null,
    documento.reajusteEm
      ? {
          rotulo: "Reajuste",
          valor: `${dataPuraCurta(documento.reajusteEm)}${documento.indiceDeReajuste ? ` · ${documento.indiceDeReajuste}` : ""}`,
        }
      : null,
    documento.multa ? { rotulo: "Multa", valor: documento.multa } : null,
    documento.avisoPrevio ? { rotulo: "Aviso prévio", valor: documento.avisoPrevio } : null,
  ].filter((item): item is { rotulo: string; valor: string } => item !== null);

  return (
    <div className="space-y-7">
      <TituloDaTela
        explicacao={[documento.tipoDeDocumento, documento.partes]
          .filter(Boolean)
          .join(" · ")}
      >
        {documento.nome}
      </TituloDaTela>

      <Aviso tom="atencao">
        Leitura feita por inteligência artificial. Confira antes de lançar. Não
        substitui a orientação de advogado ou contador.
      </Aviso>

      {documento.resumo ? (
        <Cartao>
          <h2 className="font-display text-lg font-semibold text-carvao">
            O que o Bossa entendeu
          </h2>
          <p className="mt-2 leading-relaxed text-carvao-suave">{documento.resumo}</p>
        </Cartao>
      ) : null}

      {prazos.length > 0 ? (
        <Secao titulo="Prazos do documento">
          <Cartao>
            <dl className="space-y-2.5">
              {prazos.map((prazo) => (
                <div key={prazo.rotulo} className="flex flex-wrap gap-2 text-sm">
                  <dt className="font-semibold text-carvao">{prazo.rotulo}:</dt>
                  <dd className="text-carvao-suave">{prazo.valor}</dd>
                </div>
              ))}
            </dl>
          </Cartao>
        </Secao>
      ) : null}

      <Secao
        titulo="O que o Bossa encontrou"
        explicacao="Ao lado de cada item está o trecho do documento de onde ele saiu. Confira, corrija o que estiver errado e lance só o que fizer sentido."
      >
        {itens.length === 0 ? (
          <Cartao>
            <p className="text-sm leading-relaxed text-carvao-suave">
              A leitura não encontrou nenhuma obrigação de dinheiro com data neste
              documento. Se você acha que tem, pode criar à mão em{" "}
              <Link href="/painel/vencimentos" className="font-semibold underline">
                Vencimentos
              </Link>
              .
            </p>
          </Cartao>
        ) : (
          <ul className="space-y-3">
            {itens.map((item) => (
              <li key={item.id}>
                <Item item={item} />
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <div className="flex flex-wrap gap-3 border-t border-areia-escura/60 pt-5">
        <Link href="/painel/documentos" className="botao-suave">
          Voltar para os documentos
        </Link>
        {documento.situacao === "pronto" ? (
          <form action={encerrarConferencia}>
            <input type="hidden" name="id" value={documento.id} />
            <BotaoEnviar variante="suave" enviando="Guardando...">
              {pendentes.length > 0
                ? `Terminei, descartar os ${pendentes.length} que sobraram`
                : "Terminei de conferir"}
            </BotaoEnviar>
          </form>
        ) : null}
      </div>
    </div>
  );
}
