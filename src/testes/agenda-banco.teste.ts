import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { horarioOcupado } from "@/app/painel/agenda/ocupacao";
import { valorDoAtendimento } from "@/lib/atendimento";
import { aniversariantes } from "@/lib/aniversario";
import { deDataLocal, deDataPura } from "@/lib/formato";

/**
 * A agenda no banco de verdade.
 *
 * O horário de `montarEstudio` é 5 de outubro, das 9h às 10h em São Paulo. Os
 * dois estúdios montados aqui têm horário exatamente na mesma hora, de
 * propósito: se a conferência de conflito esquecesse o estúdio, um bloquearia
 * a agenda do outro, e é isso que estes testes não deixam passar.
 */
const as = (horario: string) => new Date(`2026-10-05T${horario}:00.000-03:00`);

describe.skipIf(!TEM_BANCO)("agenda no banco", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("um");
    outro = await montarEstudio("outro");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  describe("conflito de horário", () => {
    it("acusa o horário que esbarra num atendimento do próprio estúdio", async () => {
      const db = await banco();
      const conflito = await horarioOcupado(db, {
        usuarioId: um.usuario.id,
        inicio: as("09:30"),
        duracaoMin: 60,
      });
      expect(conflito?.id).toBe(um.agendamento.id);
      expect(conflito?.cliente.nome).toBe("Cliente de um");
    });

    it("nunca enxerga a agenda de outro estúdio", async () => {
      const db = await banco();
      // O estúdio "um" libera o horário dele. O "outro" continua ocupado na
      // mesma hora, e isso não pode bloquear ninguém além dele mesmo.
      await db.agendamento.update({
        where: { id: um.agendamento.id },
        data: { status: "cancelado" },
      });

      const conflito = await horarioOcupado(db, {
        usuarioId: um.usuario.id,
        inicio: as("09:00"),
        duracaoMin: 60,
      });
      expect(conflito).toBeNull();
    });

    it("falta e cancelamento liberam o horário; concluído continua ocupando", async () => {
      const db = await banco();
      const pedido = { usuarioId: um.usuario.id, inicio: as("09:00"), duracaoMin: 60 };

      for (const status of ["faltou", "cancelado"]) {
        await db.agendamento.update({ where: { id: um.agendamento.id }, data: { status } });
        expect(await horarioOcupado(db, pedido)).toBeNull();
      }

      await db.agendamento.update({
        where: { id: um.agendamento.id },
        data: { status: "concluido" },
      });
      expect((await horarioOcupado(db, pedido))?.id).toBe(um.agendamento.id);
    });

    it("ao remarcar, o horário não esbarra nele mesmo", async () => {
      const db = await banco();
      const conflito = await horarioOcupado(db, {
        usuarioId: um.usuario.id,
        inicio: as("09:30"),
        duracaoMin: 60,
        ignorarId: um.agendamento.id,
      });
      expect(conflito).toBeNull();
    });

    it("encostar no fim do outro atendimento não é conflito", async () => {
      const db = await banco();
      const conflito = await horarioOcupado(db, {
        usuarioId: um.usuario.id,
        inicio: as("10:00"),
        duracaoMin: 60,
      });
      expect(conflito).toBeNull();
    });
  });

  describe("remarcar", () => {
    it("não remarca o horário de outro estúdio nem o que já saiu de agendado", async () => {
      const db = await banco();

      // A mesma condição da ação de remarcar, com o estúdio errado.
      const invadindo = await db.agendamento.updateMany({
        where: { id: outro.agendamento.id, usuarioId: um.usuario.id, status: "agendado" },
        data: { inicio: as("15:00") },
      });
      expect(invadindo.count).toBe(0);

      await db.agendamento.update({
        where: { id: um.agendamento.id },
        data: { status: "concluido" },
      });
      const concluido = await db.agendamento.updateMany({
        where: { id: um.agendamento.id, usuarioId: um.usuario.id, status: "agendado" },
        data: { inicio: as("15:00") },
      });
      expect(concluido.count).toBe(0);

      const intacto = await db.agendamento.findUniqueOrThrow({
        where: { id: outro.agendamento.id },
      });
      expect(intacto.inicio.toISOString()).toBe(as("09:00").toISOString());
    });
  });

  describe("valor combinado", () => {
    it("o faturamento usa o valor guardado no horário, não o preço novo do serviço", async () => {
      const db = await banco();
      await db.agendamento.update({
        where: { id: um.agendamento.id },
        data: { status: "concluido", valorCentavos: 12000 },
      });
      // O serviço subiu de preço depois do atendimento.
      await db.servico.update({ where: { id: um.servico.id }, data: { precoCentavos: 15000 } });

      const concluidos = await db.agendamento.findMany({
        where: { usuarioId: um.usuario.id, status: "concluido" },
        select: { valorCentavos: true, servico: { select: { precoCentavos: true } } },
      });
      expect(concluidos.reduce((soma, item) => soma + valorDoAtendimento(item), 0)).toBe(12000);
    });

    it("horário antigo, sem valor guardado, cai no preço do serviço", async () => {
      const db = await banco();
      const antigo = await db.agendamento.findUniqueOrThrow({
        where: { id: um.agendamento.id },
        select: { valorCentavos: true, servico: { select: { precoCentavos: true } } },
      });
      expect(antigo.valorCentavos).toBeNull();
      expect(valorDoAtendimento(antigo)).toBe(12000);
    });
  });

  describe("confirmação da véspera", () => {
    const amanha = { gte: as("00:00"), lt: new Date(as("00:00").getTime() + 86400000) };

    it("lista só os agendados do estúdio, de clientes ativos", async () => {
      const db = await banco();

      const arquivada = await db.cliente.create({
        data: {
          usuarioId: um.usuario.id,
          nome: "Arquivada",
          telefone: "66992513501",
          arquivadoEm: new Date(),
        },
      });
      await db.agendamento.create({
        data: {
          usuarioId: um.usuario.id,
          clienteId: arquivada.id,
          servicoId: um.servico.id,
          inicio: as("14:00"),
        },
      });
      await db.agendamento.create({
        data: {
          usuarioId: um.usuario.id,
          clienteId: um.cliente.id,
          servicoId: um.servico.id,
          inicio: as("16:00"),
          status: "cancelado",
        },
      });

      // A mesma consulta do painel.
      const lista = await db.agendamento.findMany({
        where: {
          usuarioId: um.usuario.id,
          status: "agendado",
          inicio: amanha,
          cliente: { arquivadoEm: null },
        },
        select: { id: true },
      });
      expect(lista.map((item) => item.id)).toEqual([um.agendamento.id]);
    });

    it("guarda o envio só no horário do próprio estúdio, e uma vez só", async () => {
      const db = await banco();
      const condicao = (usuarioId: string, id: string) => ({
        id,
        usuarioId,
        status: "agendado",
        confirmacaoEnviadaEm: null,
      });

      const invadindo = await db.agendamento.updateMany({
        where: condicao(um.usuario.id, outro.agendamento.id),
        data: { confirmacaoEnviadaEm: new Date() },
      });
      expect(invadindo.count).toBe(0);

      const primeiro = new Date("2026-10-04T13:00:00.000Z");
      const primeira = await db.agendamento.updateMany({
        where: condicao(um.usuario.id, um.agendamento.id),
        data: { confirmacaoEnviadaEm: primeiro },
      });
      const segunda = await db.agendamento.updateMany({
        where: condicao(um.usuario.id, um.agendamento.id),
        data: { confirmacaoEnviadaEm: new Date() },
      });
      expect(primeira.count).toBe(1);
      expect(segunda.count).toBe(0);

      const guardado = await db.agendamento.findUniqueOrThrow({
        where: { id: um.agendamento.id },
      });
      expect(guardado.confirmacaoEnviadaEm?.toISOString()).toBe(primeiro.toISOString());
    });
  });

  describe("aniversários", () => {
    it("só entram clientes ativos do próprio estúdio", async () => {
      const db = await banco();
      const nascimento = deDataLocal("1990-10-07")!;

      await db.cliente.update({ where: { id: um.cliente.id }, data: { nascimento } });
      await db.cliente.update({ where: { id: outro.cliente.id }, data: { nascimento } });
      await db.cliente.create({
        data: {
          usuarioId: um.usuario.id,
          nome: "Arquivada",
          telefone: "66992513501",
          nascimento,
          arquivadoEm: new Date(),
        },
      });

      // A mesma consulta do painel.
      const comNascimento = await db.cliente.findMany({
        where: { usuarioId: um.usuario.id, arquivadoEm: null, nascimento: { not: null } },
        select: { id: true, nome: true, nascimento: true },
      });
      const lista = aniversariantes(comNascimento, deDataPura("2026-10-05")!);

      expect(lista.map((item) => [item.id, item.emDias])).toEqual([[um.cliente.id, 2]]);
    });
  });
});
