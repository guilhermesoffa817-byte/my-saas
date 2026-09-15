import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { Vazio } from "@/componentes/avisos";
import {
  dataPorExtenso,
  diaDaSemana,
  emReais,
  hora,
  dataEHora,
  inicioDoDia,
  inicioDoMes,
  inicioDoProximoMes,
  primeiroNome,
  somarDias,
  telefoneBonito,
} from "@/lib/formato";

export const metadata = { title: "Painel — Agenda Online" };
export const dynamic = "force-dynamic";

function saudacao(data: Date) {
  const horaLocal = Number(hora(data).slice(0, 2));
  if (horaLocal < 12) return "Bom dia";
  if (horaLocal < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function PaginaPainel() {
  const { usuario } = await exigirAcesso();

  const agora = new Date();
  const comecoDeHoje = inicioDoDia(agora);
  const comecoDeAmanha = somarDias(comecoDeHoje, 1);
  const comecoDoMes = inicioDoMes(agora);
  const fimDoMes = inicioDoProximoMes(agora);

  const [hojeLista, proximos, totalClientes, concluidosNoMes] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        inicio: { gte: comecoDeHoje, lt: comecoDeAmanha },
        status: { not: "cancelado" },
      },
      include: { cliente: true, servico: true },
      orderBy: { inicio: "asc" },
    }),
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        inicio: { gte: comecoDeAmanha },
        status: "agendado",
      },
      include: { cliente: true, servico: true },
      orderBy: { inicio: "asc" },
      take: 5,
    }),
    prisma.cliente.count({ where: { usuarioId: usuario.id } }),
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        status: "concluido",
        inicio: { gte: comecoDoMes, lt: fimDoMes },
      },
      include: { servico: true },
    }),
  ]);

  const faturamento = concluidosNoMes.reduce(
    (soma, item) => soma + item.servico.precoCentavos,
    0,
  );

  const resumo = [
    { rotulo: "Atendimentos hoje", valor: String(hojeLista.length) },
    { rotulo: "Concluídos no mês", valor: String(concluidosNoMes.length) },
    { rotulo: "Faturamento do mês", valor: emReais(faturamento) },
    { rotulo: "Clientes cadastradas", valor: String(totalClientes) },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-carvao-suave">
          {diaDaSemana(agora).replace(/^./, (l) => l.toUpperCase())}, {dataPorExtenso(agora)}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-carvao md:text-4xl">
          {saudacao(agora)}, {primeiroNome(usuario.nome)}
        </h1>
        <p className="mt-2 text-carvao-suave">
          {hojeLista.length === 0
            ? "Hoje a agenda está livre. Um bom dia para respirar ou chamar aquela cliente que sumiu."
            : hojeLista.length === 1
              ? "Você tem um atendimento hoje. Vai ser tranquilo."
              : `Você tem ${hojeLista.length} atendimentos hoje. Vamos com calma, um de cada vez.`}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {resumo.map((item) => (
          <div key={item.rotulo} className="cartao py-5">
            <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
              {item.rotulo}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-carvao">{item.valor}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="cartao">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-carvao">Agenda de hoje</h2>
            <Link href="/painel/agenda" className="text-sm font-semibold text-terracota hover:underline">
              Abrir agenda
            </Link>
          </div>

          {hojeLista.length === 0 ? (
            <div className="mt-5">
              <Vazio
                titulo="Nenhum horário marcado para hoje"
                texto="Quando você marcar um atendimento, ele aparece aqui com horário, cliente e serviço."
              />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {hojeLista.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-areia-escura/70 bg-creme px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display text-lg font-semibold text-terracota">
                      {hora(item.inicio)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-carvao">{item.cliente.nome}</p>
                      <p className="text-xs text-carvao-suave">
                        {item.servico.nome} · {telefoneBonito(item.cliente.telefone)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-carvao-suave">
                    {item.status === "concluido" ? "Concluído" : "Agendado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cartao">
          <h2 className="font-display text-xl font-semibold text-carvao">Próximos dias</h2>
          {proximos.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-carvao-suave">
              Nada marcado ainda para os próximos dias. Assim que você agendar, mostramos aqui.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {proximos.map((item) => (
                <li key={item.id} className="rounded-2xl bg-areia/40 px-4 py-3">
                  <p className="text-sm font-semibold text-carvao">{item.cliente.nome}</p>
                  <p className="text-xs text-carvao-suave">
                    {dataEHora(item.inicio)} · {item.servico.nome}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 space-y-2">
            <Link href="/painel/agenda" className="botao w-full">
              Marcar um horário
            </Link>
            <Link href="/painel/clientes" className="botao-suave w-full">
              Cadastrar uma cliente
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
