"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritaDoRecurso } from "@/lib/guardas";
import { limiteDeIa } from "@/lib/recursos";
import { ehNatureza } from "@/lib/custos/calculo";
import {
  carregarMovimento,
  definirNatureza,
  gravarClassificacoes,
  mesDaTela,
  nomesParaOcultar,
} from "@/lib/custos/operacoes";
import {
  motivoDoQueSobrou,
  planejarSugestao,
  resumoDaSugestao,
  type MotivoSemIa,
} from "@/lib/custos/sugestao";
import {
  TAMANHO_DO_LOTE,
  classificarComFranquia,
  descricoesAnteriores,
} from "@/lib/ia/classificar-custos";
import { iaConfigurada } from "@/lib/ia/cliente";

export type Resposta = { erro?: string; recado?: string } | null;

/** Lotes por clique: cinco lotes de 30 em paralelo, 150 despesas no máximo. */
const LOTES_POR_VEZ = 5;

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function atualizarTelas() {
  revalidatePath("/painel/financas/custos");
}

/** A dona escolhe a natureza de uma despesa, ou volta para "sem classificação". */
export async function corrigirNatureza(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("custos");
  const id = texto(dados, "id");
  const escolha = texto(dados, "natureza");

  if (!id) return { erro: "Não encontramos essa despesa." };
  if (escolha !== "nenhuma" && !ehNatureza(escolha)) {
    return { erro: "Escolha fixo, variável ou fora da operação." };
  }

  // O id veio do navegador: a gravação confere que a despesa é deste estúdio.
  const mudou = await definirNatureza(prisma, usuario.id, id, escolha);
  if (!mudou) return { erro: "Não encontramos essa despesa." };

  atualizarTelas();
  return { recado: escolha === "nenhuma" ? "Classificação apagada." : "Classificação salva." };
}

/**
 * "Sugerir classificação": para as despesas do mês ainda sem natureza, aplica
 * as regras e manda o resto à IA, se ela estiver ligada e houver franquia.
 * Nunca troca o que já tem natureza, em especial o que a dona marcou.
 */
export async function sugerirClassificacao(_anterior: Resposta, dados: FormData): Promise<Resposta> {
  const { usuario } = await exigirEscritaDoRecurso("custos");
  const mes = mesDaTela(texto(dados, "mes"));

  let movimento;
  try {
    movimento = await carregarMovimento(prisma, usuario.id, mes);
  } catch {
    return { erro: "Não consegui ler as despesas do mês. Tente de novo." };
  }

  const plano = planejarSugestao({ mes, despesas: movimento.despesas });
  const porRegra = await gravarClassificacoes(prisma, usuario.id, plano.porRegra, "regra");

  let porIa = 0;
  let recusadas = 0;
  let semIa = plano.paraIa.length;
  let motivoSemIa: MotivoSemIa | null = null;
  let erroDaIa: string | null = null;

  if (plano.paraIa.length > 0) {
    const limite = limiteDeIa(usuario, "classificacao");
    if (!iaConfigurada()) {
      motivoSemIa = "nao_configurada";
    } else if (limite <= 0) {
      motivoSemIa = "franquia";
    } else {
      // Sem a lista de nomes a esconder, nenhuma descrição sai do servidor.
      let nomes: string[] | null = null;
      try {
        nomes = await nomesParaOcultar(prisma, usuario.id);
      } catch {
        erroDaIa = "Não consegui preparar as despesas para a IA.";
        motivoSemIa = "erro";
      }

      if (nomes) {
        const resultado = await classificarComFranquia(prisma, {
          usuarioId: usuario.id,
          limite,
          despesas: plano.paraIa,
          maximo: TAMANHO_DO_LOTE * LOTES_POR_VEZ,
          anteriores: descricoesAnteriores(movimento.despesas, mes),
          nomes,
          // Grava lote a lote: se a hospedagem cortar o pedido, o que já voltou fica.
          aoTerminarLote: async (sugestoes) => {
            // Primeiro o await, depois a soma: os lotes terminam em paralelo, e
            // `porIa += await ...` leria o total antigo e perderia a soma de outro lote.
            const gravadas = await gravarClassificacoes(
              prisma,
              usuario.id,
              sugestoes.map((s) => ({ id: s.lancamentoId, natureza: s.natureza, motivo: s.motivo })),
              "ia",
            );
            porIa += gravadas;
          },
        });
        erroDaIa = resultado.erro;
        recusadas = resultado.recusadas.length;

        semIa = Math.max(0, plano.paraIa.length - porIa - recusadas);
        if (semIa > 0) {
          motivoSemIa = motivoDoQueSobrou({
            erroDaIa,
            enviados: resultado.enviados,
            total: plano.paraIa.length,
            limitadoPelaFranquia: resultado.limitadoPelaFranquia,
            interrompido: resultado.interrompido,
          });
        }
      }
    }
  }

  if (porRegra > 0 || porIa > 0) atualizarTelas();

  const frase = resumoDaSugestao({ porRegra, porIa, semIa, motivoSemIa, recusadas });
  if (erroDaIa && porIa === 0 && porRegra === 0 && recusadas === 0) return { erro: erroDaIa };
  return { recado: erroDaIa ? `${frase} ${erroDaIa}` : frase };
}
