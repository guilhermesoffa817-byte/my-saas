import { hora } from "@/lib/formato";

/**
 * O cartão "atendimentos de hoje" do Início, em palavras.
 *
 * Conta só o que ainda está agendado: concluído já foi feito e cancelado não
 * vai acontecer. E fala do próximo de verdade, não do primeiro da lista (que
 * pode já ter sido concluído de manhã). O que já passou sem ser concluído
 * aparece à parte, para a dona lembrar de marcar.
 */

export type HorarioDeHoje = {
  inicio: Date;
  status: string;
  cliente: { nome: string };
  servico: { duracaoMin: number };
};

export type ChamadaDeHoje = { titulo: string; detalhe: string };

function fimDe(item: HorarioDeHoje) {
  return new Date(item.inicio.getTime() + item.servico.duracaoMin * 60_000);
}

export function chamadaDeHoje(lista: HorarioDeHoje[], agora: Date): ChamadaDeHoje | null {
  const emAberto = lista
    .filter((item) => item.status === "agendado")
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (emAberto.length === 0) return null;

  const porVir = emAberto.filter((item) => fimDe(item) > agora);
  const passados = emAberto.length - porVir.length;

  if (porVir.length === 0) {
    const primeiro = emAberto[0];
    return {
      titulo:
        passados === 1
          ? "1 atendimento de hoje para concluir"
          : `${passados} atendimentos de hoje para concluir`,
      detalhe: `${primeiro.cliente.nome}, às ${hora(primeiro.inicio)}${
        passados > 1 ? ` e mais ${passados - 1}` : ""
      }. Marque como concluído na agenda.`,
    };
  }

  const proximo = porVir[0];
  const agoraMesmo = proximo.inicio <= agora;
  const frase = agoraMesmo
    ? `Em atendimento agora: ${proximo.cliente.nome}, até as ${hora(fimDe(proximo))}.`
    : `O próximo é às ${hora(proximo.inicio)}, de ${proximo.cliente.nome}.`;
  const lembrete =
    passados === 0
      ? ""
      : passados === 1
        ? " 1 que já passou ainda não foi marcado como concluído."
        : ` ${passados} que já passaram ainda não foram marcados como concluídos.`;

  return {
    titulo: porVir.length === 1 ? "Falta 1 atendimento hoje" : `Faltam ${porVir.length} atendimentos hoje`,
    detalhe: frase + lembrete,
  };
}
