import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { agoraDoPedido } from "@/lib/agora";
import { NOME_DO_PRODUTO } from "@/lib/site";
import {
  carregarAgendaPublica,
  horariosOferecidos,
  lerPedidoDePessoa,
  type AgendaPublica,
  type DiaOferecido,
} from "@/lib/agendamento-online/operacoes";
import { deHorarioLocal, diaDaSemanaCurto, emReais, hora } from "@/lib/formato";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import { ConfirmarHorario } from "./confirmar";

export const dynamic = "force-dynamic";

/** A mesma leitura serve aos metadados e à página, no mesmo pedido. */
const carregar = cache((link: string) => carregarAgendaPublica(prisma, link, agoraDoPedido()));

type Parametros = { servico?: string; quem?: string; dia?: string; hora?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ link: string }>;
}): Promise<Metadata> {
  const { link } = await params;
  const pagina = await carregar(link);
  return {
    title:
      pagina.situacao === "aberta" ? `Agendar em ${pagina.agenda.nomeNegocio}` : "Agendamento online",
    // Página de cada estúdio, feita para o cliente dele: não é para o Google.
    robots: { index: false, follow: false },
  };
}

/** "seg 19/10", com o dia lido ao meio-dia de São Paulo para não escorregar. */
function rotuloDoDia(dia: string) {
  const meioDia = deHorarioLocal(`${dia}T12:00`)!;
  return { semana: diaDaSemanaCurto(meioDia), data: `${dia.slice(8, 10)}/${dia.slice(5, 7)}` };
}

function enderecoDoPasso(link: string, escolhas: Parametros, ancora?: string) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(escolhas)) {
    if (valor) busca.set(chave, valor);
  }
  const texto = busca.toString();
  return `/agendar/${link}${texto ? `?${texto}` : ""}${ancora ? `#${ancora}` : ""}`;
}

/**
 * A página que o estúdio divulga para o cliente marcar sozinho.
 *
 * Cada escolha (serviço, com quem, dia, horário) vai no endereço e a página é
 * montada no servidor. Assim ela abre rápido em celular simples, funciona até
 * sem JavaScript e o botão de voltar do aparelho volta um passo. Só o último
 * passo, o formulário, roda no navegador.
 */
export default async function PaginaDeAgendamento({
  params,
  searchParams,
}: {
  params: Promise<{ link: string }>;
  searchParams: Promise<Parametros>;
}) {
  const { link } = await params;
  const escolhas = await searchParams;
  const pagina = await carregar(link);

  if (pagina.situacao === "nao_encontrada") notFound();

  if (pagina.situacao === "indisponivel") {
    return (
      <Moldura>
        <h1 className="font-display text-2xl font-semibold text-carvao">
          Agendamento online indisponível no momento
        </h1>
        <p className="mt-2 leading-relaxed text-carvao-suave">
          Não dá para marcar por aqui agora. Fale direto com o estúdio para
          combinar o seu horário.
        </p>
      </Moldura>
    );
  }

  const agenda = pagina.agenda;
  const agora = agoraDoPedido();

  const servico = agenda.servicos.find((item) => item.id === escolhas.servico) ?? null;
  const pedido = servico ? lerPedidoDePessoa(agenda, escolhas.quem) : null;
  const pessoaEscolhida =
    pedido && "id" in pedido && agenda.escolhe
      ? (agenda.pessoas.find((item) => item.id === pedido.id) ?? null)
      : null;

  const dias: DiaOferecido[] =
    servico && pedido ? await horariosOferecidos(prisma, agenda, servico, pedido, agora) : [];
  const diasComHorario = dias.filter((item) => item.horarios.length > 0);
  const diaEscolhido = diasComHorario.find((item) => item.dia === escolhas.dia) ?? null;
  const horarioEscolhido =
    diaEscolhido?.horarios.find((item) => hora(item.inicio) === escolhas.hora) ?? null;

  const base = { servico: servico?.id, quem: agenda.escolhe ? escolhas.quem : undefined };
  const whatsapp = telefoneParaWhatsApp(agenda.telefoneDoEstudio);
  const falarComEstudio = whatsapp.certo
    ? linkDoWhatsApp(whatsapp.paraWhatsApp, "Olá! Quero marcar um horário.")
    : null;

  return (
    <Moldura agenda={agenda}>
      <ol className="space-y-4">
        {/* 1. Serviço */}
        <Passo numero={1} titulo="Escolha o serviço" feito={Boolean(servico)}>
          {servico ? (
            <Escolhido
              texto={`${servico.nome} · ${servico.duracaoMin} min · ${emReais(servico.precoCentavos)}`}
              trocar={enderecoDoPasso(agenda.link, {})}
            />
          ) : agenda.servicos.length === 0 ? (
            <p className="text-sm text-carvao-suave">
              Nenhum serviço disponível pelo link agora. Fale direto com o estúdio.
            </p>
          ) : (
            <ul className="space-y-2">
              {agenda.servicos.map((item) => (
                <li key={item.id}>
                  <Link
                    prefetch={false}
                    href={enderecoDoPasso(
                      agenda.link,
                      { servico: item.id },
                      agenda.escolhe ? "passo-2" : "passo-dia",
                    )}
                    className="flex items-center justify-between gap-3 rounded-xl border border-areia-escura bg-superficie px-4 py-3 transition hover:border-terracota"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-carvao">{item.nome}</span>
                      <span className="block text-sm text-carvao-suave">
                        {item.duracaoMin} min
                        {item.descricao ? ` · ${item.descricao}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-terracota">
                      {emReais(item.precoCentavos)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Passo>

        {/* 2. Com quem (só com equipe) */}
        {agenda.escolhe && servico ? (
          <Passo numero={2} titulo="Com quem" feito={Boolean(pedido)} id="passo-2">
            {pedido ? (
              <Escolhido
                texto={pessoaEscolhida ? pessoaEscolhida.nome : "Tanto faz"}
                trocar={enderecoDoPasso(agenda.link, { servico: servico.id }, "passo-2")}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {[{ chave: "qualquer", nome: "Tanto faz" }, ...agenda.pessoas].map((pessoa) => (
                  <Link
                    key={pessoa.chave}
                    prefetch={false}
                    href={enderecoDoPasso(
                      agenda.link,
                      { servico: servico.id, quem: pessoa.chave },
                      "passo-dia",
                    )}
                    className="botao-suave"
                  >
                    {pessoa.nome}
                  </Link>
                ))}
              </div>
            )}
          </Passo>
        ) : null}

        {/* 3. Dia */}
        {servico && pedido ? (
          <Passo
            numero={agenda.escolhe ? 3 : 2}
            titulo="Escolha o dia"
            feito={Boolean(diaEscolhido)}
            id="passo-dia"
          >
            {diasComHorario.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-carvao-suave">
                  Sem horário livre nos próximos {agenda.diasAFrente} dias para esse
                  serviço. Fale com o estúdio, que ele encaixa você.
                </p>
                {falarComEstudio ? (
                  <a href={falarComEstudio} target="_blank" rel="noopener noreferrer" className="botao-suave">
                    Falar no WhatsApp
                  </a>
                ) : null}
              </div>
            ) : (
              <div
                className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
                role="list"
                aria-label="Dias com horário livre"
              >
                {diasComHorario.map((item) => {
                  const rotulo = rotuloDoDia(item.dia);
                  const ativo = item.dia === diaEscolhido?.dia;
                  return (
                    <Link
                      key={item.dia}
                      role="listitem"
                      prefetch={false}
                      aria-current={ativo ? "date" : undefined}
                      href={enderecoDoPasso(agenda.link, { ...base, dia: item.dia }, "passo-horario")}
                      className={`flex min-w-16 shrink-0 snap-start flex-col items-center rounded-xl border px-3 py-2.5 text-sm transition ${
                        ativo
                          ? "border-terracota bg-terracota text-acento-texto"
                          : "border-areia-escura bg-superficie text-carvao hover:border-terracota"
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase">{rotulo.semana}</span>
                      <span className="font-display text-base font-semibold tabular-nums">{rotulo.data}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Passo>
        ) : null}

        {/* 4. Horário */}
        {diaEscolhido ? (
          <Passo
            numero={agenda.escolhe ? 4 : 3}
            titulo="Escolha o horário"
            feito={Boolean(horarioEscolhido)}
            id="passo-horario"
          >
            {escolhas.hora && !horarioEscolhido ? (
              <p className="mb-3 text-sm text-carvao-suave">
                Esse horário não está mais livre. Escolha outro, por favor.
              </p>
            ) : null}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {diaEscolhido.horarios.map((item) => {
                const texto = hora(item.inicio);
                const ativo = horarioEscolhido?.inicio.getTime() === item.inicio.getTime();
                return (
                  <Link
                    key={item.inicio.getTime()}
                    prefetch={false}
                    aria-current={ativo ? "time" : undefined}
                    href={enderecoDoPasso(
                      agenda.link,
                      { ...base, dia: diaEscolhido.dia, hora: texto },
                      "passo-dados",
                    )}
                    className={`rounded-xl border px-2 py-2.5 text-center text-sm font-semibold tabular-nums transition ${
                      ativo
                        ? "border-terracota bg-terracota text-acento-texto"
                        : "border-areia-escura bg-superficie text-carvao hover:border-terracota"
                    }`}
                  >
                    {texto}
                  </Link>
                );
              })}
            </div>
          </Passo>
        ) : null}

        {/* 5. Dados e confirmação */}
        {servico && diaEscolhido && horarioEscolhido ? (
          <Passo numero={agenda.escolhe ? 5 : 4} titulo="Seus dados" feito={false} id="passo-dados">
            <ConfirmarHorario
              link={agenda.link}
              servico={servico.id}
              quem={agenda.escolhe ? (escolhas.quem ?? "") : ""}
              dia={diaEscolhido.dia}
              hora={hora(horarioEscolhido.inicio)}
              nomeNegocio={agenda.nomeNegocio}
              voltarParaHorarios={enderecoDoPasso(
                agenda.link,
                { ...base, dia: diaEscolhido.dia },
                "passo-horario",
              )}
            />
          </Passo>
        ) : null}
      </ol>
    </Moldura>
  );
}

function Moldura({ agenda, children }: { agenda?: AgendaPublica; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pt-6 pb-12">
      <header className="animar-entrada mb-6">
        {agenda ? (
          <>
            <p className="text-xs font-semibold tracking-widest text-terracota uppercase">
              Agende seu horário
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-carvao">
              {agenda.nomeNegocio}
            </h1>
            {agenda.endereco ? (
              <p className="mt-1 text-sm leading-relaxed text-carvao-suave">{agenda.endereco}</p>
            ) : null}
          </>
        ) : null}
      </header>
      <main>{children}</main>
      <footer className="mt-10 text-center text-xs text-carvao-suave">
        Agenda online feita com {NOME_DO_PRODUTO} ·{" "}
        <Link href="/privacidade" className="underline underline-offset-2 hover:text-terracota">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}

function Passo({
  numero,
  titulo,
  feito,
  id,
  children,
}: {
  numero: number;
  titulo: string;
  feito: boolean;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <li id={id} className="animar-entrada scroll-mt-4 rounded-2xl border border-areia-escura/70 bg-superficie p-4">
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-base font-semibold text-carvao">
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            feito ? "bg-terracota text-acento-texto" : "bg-areia text-carvao-suave"
          }`}
        >
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </li>
  );
}

function Escolhido({ texto, trocar }: { texto: string; trocar: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 text-sm font-semibold text-carvao">{texto}</p>
      <Link prefetch={false} href={trocar} className="botao-texto shrink-0">
        Trocar
      </Link>
    </div>
  );
}
