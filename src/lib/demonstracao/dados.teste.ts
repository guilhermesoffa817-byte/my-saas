import { describe, expect, it } from "vitest";
import { idValido } from "@/lib/assistente/protocolo";
import { competenciaAtual, paraDataLocal, paraDataPura, somarMeses } from "@/lib/formato";
import { situacaoDaCobranca } from "@/lib/cobranca";
import { ID_DO_ESTUDIO_DE_EXEMPLO, PAPEL_DA_DEMONSTRACAO, ehContaDeExemplo, emailReservado } from "./conta";
import { montarEstudioDeExemplo } from "./dados";
import { precisaRefazer } from "./estudio";

// Uma sexta-feira às 10h30 em São Paulo.
const AGORA = new Date("2026-10-16T13:30:00.000Z");
const HOJE = "2026-10-16";
const dados = montarEstudioDeExemplo(AGORA);

describe("o estúdio de exemplo", () => {
  it("sai igual para o mesmo instante: o sorteio tem semente fixa", () => {
    const outra = montarEstudioDeExemplo(AGORA);
    expect(outra.agendamentos.map((item) => item.id)).toEqual(dados.agendamentos.map((item) => item.id));
    expect(outra.lancamentos.length).toBe(dados.lancamentos.length);
  });

  it("é uma conta de demonstração que ninguém consegue usar para entrar", () => {
    expect(dados.usuario.id).toBe(ID_DO_ESTUDIO_DE_EXEMPLO);
    expect(dados.usuario.papel).toBe(PAPEL_DA_DEMONSTRACAO);
    expect(ehContaDeExemplo({ id: dados.usuario.id, papel: dados.usuario.papel })).toBe(true);
    expect(emailReservado(dados.usuario.email)).toBe(true);
    // Não é hash do bcrypt: nenhuma senha confere.
    expect(dados.usuario.senhaHash.startsWith("$2")).toBe(false);
    expect(dados.usuario.pixChave).toMatch(/\.invalid$/);
  });

  it("tem a agenda de hoje cheia, com horário que já passou e horário por vir", () => {
    const deHoje = dados.agendamentos.filter((item) => paraDataLocal(item.inicio as Date) === HOJE);
    expect(deHoje.length).toBeGreaterThanOrEqual(4);
    expect(deHoje.some((item) => item.status === "concluido")).toBe(true);
    expect(deHoje.some((item) => item.status === "agendado")).toBe(true);
  });

  it("tem horários novos que chegaram pelo link e ainda não foram vistos", () => {
    const novos = dados.agendamentos.filter((item) => item.origem === "link" && !item.vistoEm);
    expect(novos.length).toBeGreaterThan(0);
  });

  it("não deixa dois horários da mesma pessoa baterem no mesmo dia", () => {
    const duracao = new Map(dados.servicos.map((servico) => [servico.id, servico.duracaoMin ?? 60]));
    const porPessoaEDia = new Map<string, { inicio: number; fim: number }[]>();
    for (const item of dados.agendamentos) {
      if (item.status === "cancelado") continue;
      const inicio = (item.inicio as Date).getTime();
      const chave = `${item.colaboradorId ?? "dona"}|${paraDataLocal(item.inicio as Date)}`;
      const lista = porPessoaEDia.get(chave) ?? [];
      for (const outro of lista) {
        const fim = inicio + duracao.get(item.servicoId)! * 60_000;
        expect(inicio < outro.fim && outro.inicio < fim, chave).toBe(false);
      }
      lista.push({ inicio, fim: inicio + duracao.get(item.servicoId)! * 60_000 });
      porPessoaEDia.set(chave, lista);
    }
  });

  it("tem cobrança vencendo hoje, atrasada e paga", () => {
    const hoje = new Date(`${HOJE}T00:00:00.000Z`);
    const situacoes = dados.cobrancas.map((cobranca) =>
      situacaoDaCobranca(
        { situacao: cobranca.situacao as string, vencimento: cobranca.vencimento as Date },
        hoje,
      ),
    );
    expect(dados.cobrancas.some((c) => paraDataPura(c.vencimento as Date) === HOJE && c.situacao === "aberta")).toBe(true);
    expect(situacoes).toContain("atrasada");
    expect(situacoes).toContain("paga");
    // Cada horário tem no máximo uma cobrança: o banco recusaria a segunda.
    const horarios = dados.cobrancas.map((c) => c.agendamentoId);
    expect(new Set(horarios).size).toBe(horarios.length);
  });

  it("tem conta vencendo amanhã e prazo de contrato", () => {
    expect(dados.vencimentos.some((v) => paraDataPura(v.data as Date) === "2026-10-17" && !v.pago)).toBe(true);
    expect(dados.vencimentos.some((v) => v.tipo === "prazo")).toBe(true);
  });

  it("tem seis meses de movimento, com custos classificados e alguns por classificar", () => {
    const meses = new Set(dados.lancamentos.map((item) => competenciaAtual(item.data as Date)));
    for (let passo = 0; passo < 6; passo++) {
      expect(meses.has(somarMeses("2026-10", -passo)), somarMeses("2026-10", -passo)).toBe(true);
    }
    const saidas = dados.lancamentos.filter((item) => item.tipo === "saida");
    expect(saidas.some((item) => item.natureza === "fixo")).toBe(true);
    expect(saidas.some((item) => item.natureza === "variavel")).toBe(true);
    expect(saidas.some((item) => !item.natureza)).toBe(true);
    // Nada no futuro: lançamento é dinheiro que já entrou ou saiu.
    expect(dados.lancamentos.every((item) => (item.data as Date).getTime() <= AGORA.getTime())).toBe(true);
  });

  it("liga cada pagamento da equipe à sua saída nas finanças", () => {
    const saidas = new Set(dados.lancamentos.map((item) => item.id));
    expect(dados.pagamentosDaEquipe.length).toBeGreaterThan(0);
    for (const pagamento of dados.pagamentosDaEquipe) {
      expect(saidas.has(pagamento.lancamentoId)).toBe(true);
    }
  });

  it("tem documento lido com itens e conversa do assistente com resposta pronta", () => {
    expect(dados.documentos.some((doc) => doc.situacao === "pronto")).toBe(true);
    expect(dados.itensDosDocumentos.length).toBeGreaterThan(0);
    expect(dados.mensagens.some((m) => m.papel === "assistant" && (m.textoNaTela ?? "").length > 40)).toBe(true);
    // A tela do assistente só abre conversa com id só de letras e números.
    for (const conversa of dados.conversas) expect(idValido(conversa.id)).toBe(true);
  });

  it("deixa o agendamento online configurado e o mês passado fechado", () => {
    expect(dados.agendaOnline.ativa).toBe(true);
    expect(dados.faixas.length).toBeGreaterThan(0);
    expect(dados.mesFechado.competencia).toBe("2026-09");
  });

  it("grava tudo na conta de exemplo, e só nela", () => {
    const listas = [
      dados.clientes,
      dados.servicos,
      dados.colaboradores,
      dados.ausencias,
      dados.agendamentos,
      dados.lancamentos,
      dados.pagamentosDaEquipe,
      dados.cobrancas,
      dados.repeticoes,
      dados.vencimentos,
      dados.documentos,
      dados.conversas,
      dados.mensagens,
      dados.usosDeIa,
      dados.faixas,
    ];
    for (const lista of listas) {
      for (const item of lista) expect(item.usuarioId).toBe(ID_DO_ESTUDIO_DE_EXEMPLO);
    }
    expect(dados.agendaOnline.usuarioId).toBe(ID_DO_ESTUDIO_DE_EXEMPLO);
  });
});

describe("quando refazer os dados", () => {
  it("refaz depois de 12 horas ou quando o dia muda em São Paulo", () => {
    const criado = new Date("2026-10-16T12:00:00.000Z"); // 9h em São Paulo
    expect(precisaRefazer(criado, new Date("2026-10-16T20:00:00.000Z"))).toBe(false);
    expect(precisaRefazer(criado, new Date("2026-10-16T23:00:00.000Z"))).toBe(false); // 20h, 11 horas depois
    expect(precisaRefazer(criado, new Date("2026-10-17T03:30:00.000Z"))).toBe(true); // 0h30 do dia seguinte
    const cedo = new Date("2026-10-16T03:30:00.000Z"); // 0h30
    expect(precisaRefazer(cedo, new Date("2026-10-16T16:00:00.000Z"))).toBe(true); // 12h30 depois
  });
});
