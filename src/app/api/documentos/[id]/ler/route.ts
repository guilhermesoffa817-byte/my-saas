import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { baixar } from "@/lib/arquivos";
import { lerDocumento, MODELO_PADRAO, type ClienteDaLeitura } from "@/lib/leitura";

export const dynamic = "force-dynamic";
/* A leitura é demorada; sem isto o Next poderia tentar tratar a rota como estática. */
export const maxDuration = 300;

/**
 * Dispara a leitura de um documento.
 *
 * Esta rota é curta de propósito: ela junta o arquivo, chama lib/leitura.ts e
 * grava o resultado. A chamada demorada está isolada aqui para poder mudar de
 * lugar sem mexer no resto do Bossa.
 *
 * Por que isso importa: no plano grátis da Netlify uma função tem dez segundos
 * para responder, e as funções longas são de plano pago. Ler um contrato leva
 * mais do que isso. Enquanto a leitura não tiver uma casa com tempo suficiente,
 * esta rota vai ser cortada no meio em documentos de verdade. O Bossa foi feito
 * para aguentar isso: o documento fica em "Lendo", a tela percebe que a leitura
 * parou e oferece "Tentar de novo". Nada se perde e nada fica pela metade.
 */
export async function POST(
  _pedido: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { usuario } = await exigirRecurso("documentos");
  const { id } = await params;

  const documento = await prisma.documento.findFirst({
    where: { id, usuarioId: usuario.id },
    select: { id: true, caminho: true, situacao: true },
  });
  if (!documento) {
    return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  }
  if (documento.situacao === "conferido") {
    return NextResponse.json({ situacao: "conferido" });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    await marcarFalha(
      documento.id,
      "A leitura automática ainda não está ativa nesta conta. Você pode criar os vencimentos à mão.",
    );
    return NextResponse.json({ situacao: "falhou" });
  }

  const arquivo = await baixar(documento.caminho);
  if (!arquivo) {
    await marcarFalha(documento.id, "Não consegui abrir o arquivo enviado.");
    return NextResponse.json({ situacao: "falhou" });
  }

  const cliente = new Anthropic({ apiKey: chave }) as unknown as ClienteDaLeitura;
  const leitura = await lerDocumento({
    cliente,
    arquivos: [arquivo],
    modelo: process.env.ANTHROPIC_MODELO ?? MODELO_PADRAO,
  });

  if (!leitura.certo) {
    await marcarFalha(documento.id, leitura.motivo);
    return NextResponse.json({ situacao: "falhou", motivo: leitura.motivo });
  }

  await prisma.$transaction(async (tx) => {
    // Uma releitura substitui o que estava lá; itens já aceitos ficam, porque
    // aquilo já virou vencimento de verdade.
    await tx.itemDoDocumento.deleteMany({
      where: { documentoId: documento.id, decisao: null },
    });

    await tx.documento.update({
      where: { id: documento.id },
      data: {
        situacao: "pronto",
        motivoDaFalha: null,
        tipoDeDocumento: leitura.documento.tipo,
        partes: leitura.documento.partes,
        resumo: leitura.documento.resumo,
        fimDoContrato: leitura.documento.fimDoContrato,
        reajusteEm: leitura.documento.reajusteEm,
        indiceDeReajuste: leitura.documento.indiceDeReajuste,
        multa: leitura.documento.multa,
        avisoPrevio: leitura.documento.avisoPrevio,
      },
    });

    if (leitura.itens.length > 0) {
      await tx.itemDoDocumento.createMany({
        data: leitura.itens.map((item) => ({
          documentoId: documento.id,
          descricao: item.descricao,
          tipo: item.tipo,
          valorCentavos: item.valorCentavos,
          data: item.data,
          repeticao: item.repeticao,
          repeteAte: item.repeteAte,
          trecho: item.trecho,
          pagina: item.pagina,
          duvidoso: item.duvidoso,
        })),
      });
    }
  });

  return NextResponse.json({ situacao: "pronto", quantos: leitura.itens.length });
}

async function marcarFalha(documentoId: string, motivo: string) {
  await prisma.documento.update({
    where: { id: documentoId },
    data: { situacao: "falhou", motivoDaFalha: motivo },
  });
}
