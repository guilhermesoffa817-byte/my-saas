import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { agoraDoPedido } from "@/lib/agora";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import {
  Aviso,
  Etiqueta,
  ROTULO_DA_COBRANCA,
  TOM_DA_COBRANCA,
  type Tom,
} from "@/componentes/ui/etiqueta";
import { BotaoEnviar } from "@/componentes/ui/botao";
import {
  ROTULO_DA_SITUACAO,
  situacaoValida,
  valorDoAtendimento,
  type SituacaoDoAtendimento,
} from "@/lib/atendimento";
import { prazoPorExtenso, situacaoDaCobranca } from "@/lib/cobranca";
import { resumoDoHistorico, separarAtendimentos, temHistorico } from "@/lib/historico";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import {
  cpfBonito,
  dataCurta,
  dataPuraCurta,
  diaDaSemanaCurto,
  emReais,
  hojeNoEstudio,
  hora,
  paraDataLocal,
  telefoneBonito,
} from "@/lib/formato";
import { mudarLembretesDoCliente } from "../../cobrancas/acoes";
import { FormularioCliente } from "../formulario";
import { BotaoDesarquivar, BotaoTirarDaLista } from "../tirar-da-lista";

export const metadata = { title: "Ficha do cliente" };
export const dynamic = "force-dynamic";

/** Quantos atendimentos anteriores a ficha mostra. O resumo conta todos. */
const ANTERIORES_NA_TELA = 20;

const TOM_DA_SITUACAO: Record<SituacaoDoAtendimento, Tom> = {
  agendado: "espera",
  concluido: "boa",
  faltou: "atencao",
  cancelado: "calma",
};

export default async function PaginaDoCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { usuario } = await exigirAcesso();
  const { id } = await params;

  // O estúdio da sessão entra na busca. A ficha de outro estúdio não é
  // "proibida": ela simplesmente não existe para quem perguntou.
  const cliente = await prisma.cliente.findFirst({
    where: { id, usuarioId: usuario.id },
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      cpf: true,
      endereco: true,
      nascimento: true,
      observacoes: true,
      semLembretes: true,
      arquivadoEm: true,
    },
  });

  if (!cliente) notFound();

  const temCobranca = podeUsar(usuario, "cobrar");
  const daCliente = { clienteId: cliente.id, usuarioId: usuario.id };

  const [atendimentos, abertas, pagas, totalDeCobrancas] = await Promise.all([
    prisma.agendamento.findMany({
      where: daCliente,
      orderBy: { inicio: "desc" },
      select: {
        id: true,
        inicio: true,
        status: true,
        valorCentavos: true,
        servico: { select: { nome: true, precoCentavos: true } },
      },
    }),
    temCobranca
      ? prisma.cobranca.findMany({
          where: { ...daCliente, situacao: "aberta" },
          orderBy: { vencimento: "asc" },
          select: {
            id: true,
            valorCentavos: true,
            vencimento: true,
            situacao: true,
            pagaEm: true,
            agendamento: { select: { servico: { select: { nome: true } } } },
          },
        })
      : Promise.resolve([]),
    temCobranca
      ? prisma.cobranca.findMany({
          where: { ...daCliente, situacao: "paga" },
          orderBy: [{ pagaEm: { sort: "desc", nulls: "last" } }, { vencimento: "desc" }],
          take: 20,
          select: {
            id: true,
            valorCentavos: true,
            vencimento: true,
            situacao: true,
            pagaEm: true,
            agendamento: { select: { servico: { select: { nome: true } } } },
          },
        })
      : Promise.resolve([]),
    prisma.cobranca.count({ where: daCliente }),
  ]);

  const agora = agoraDoPedido();
  const hoje = hojeNoEstudio(agora);
  const resumo = resumoDoHistorico(atendimentos, agora);
  const { proximos, anteriores, anterioresForaDaLista } = separarAtendimentos(
    atendimentos,
    agora,
    ANTERIORES_NA_TELA,
  );

  const arquivada = cliente.arquivadoEm !== null;
  const comHistorico = temHistorico({
    atendimentos: atendimentos.length,
    cobrancas: totalDeCobrancas,
  });

  const telefone = telefoneParaWhatsApp(cliente.telefone);
  const linkDaConversa = telefone.certo ? linkDoWhatsApp(telefone.paraWhatsApp, "") : null;

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <TituloDaTela
          explicacao={
            cliente.arquivadoEm
              ? `Ficha arquivada em ${dataCurta(cliente.arquivadoEm)}. O histórico continua guardado e contando no faturamento.`
              : undefined
          }
        >
          <span className="break-words">{cliente.nome}</span>
        </TituloDaTela>

        {arquivada || cliente.semLembretes ? (
          <div className="flex flex-wrap gap-2">
            {arquivada ? <Etiqueta tom="calma">Arquivada</Etiqueta> : null}
            {cliente.semLembretes ? <Etiqueta tom="calma">Sem lembretes</Etiqueta> : null}
          </div>
        ) : null}
      </div>

      {arquivada ? (
        <div className="space-y-3">
          <Aviso tom="calma">
            Ficha arquivada não aparece na lista de clientes nem na hora de marcar
            ou de cobrar. Para voltar a atender, é só desarquivar.
          </Aviso>
          <BotaoDesarquivar id={cliente.id} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link href="/painel/agenda" className="botao">
            Abrir agenda
          </Link>
          {temCobranca ? (
            <Link href={`/painel/cobrancas/nova?cliente=${cliente.id}`} className="botao-suave">
              Cobrar
            </Link>
          ) : null}
        </div>
      )}

      <Cartao>
        <dl className="space-y-2 text-sm">
          <Linha rotulo="WhatsApp">
            {linkDaConversa ? (
              <a
                href={linkDaConversa}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold whitespace-nowrap text-terracota hover:underline"
              >
                {telefoneBonito(cliente.telefone)}
              </a>
            ) : (
              <>
                {telefoneBonito(cliente.telefone)}
                {!telefone.certo ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-carvao-suave">
                    {telefone.motivo}
                  </span>
                ) : null}
              </>
            )}
          </Linha>
          {cliente.email ? (
            <Linha rotulo="E-mail">
              <a
                href={`mailto:${cliente.email}`}
                className="wrap-anywhere text-terracota hover:underline"
              >
                {cliente.email}
              </a>
            </Linha>
          ) : null}
          {cliente.nascimento ? (
            <Linha rotulo="Aniversário">{dataCurta(cliente.nascimento)}</Linha>
          ) : null}
          {cliente.cpf ? <Linha rotulo="CPF">{cpfBonito(cliente.cpf)}</Linha> : null}
          {cliente.endereco ? <Linha rotulo="Endereço">{cliente.endereco}</Linha> : null}
        </dl>

        {cliente.observacoes ? (
          <p className="mt-4 rounded-2xl bg-areia/40 px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-line text-carvao-suave">
            {cliente.observacoes}
          </p>
        ) : null}

        {!arquivada ? (
          <details className="mt-4">
            <summary className="botao-suave cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Editar ficha
            </summary>
            <div className="mt-4 rounded-2xl bg-creme p-4">
              <FormularioCliente
                cliente={{
                  id: cliente.id,
                  nome: cliente.nome,
                  telefone: cliente.telefone,
                  email: cliente.email,
                  cpf: cliente.cpf,
                  endereco: cliente.endereco,
                  nascimento: cliente.nascimento ? paraDataLocal(cliente.nascimento) : null,
                  observacoes: cliente.observacoes,
                }}
              />
            </div>
          </details>
        ) : null}
      </Cartao>

      <Secao titulo="Resumo">
        <Cartao>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Numero
              rotulo="Visitas"
              valor={String(resumo.visitas)}
              detalhe={resumo.visitas === 1 ? "atendimento concluído" : "atendimentos concluídos"}
            />
            <Numero
              rotulo="Total gasto"
              valor={emReais(resumo.totalGastoCentavos)}
              detalhe="nos atendimentos concluídos"
            />
            <Numero
              rotulo="Faltas"
              valor={String(resumo.faltas)}
              detalhe={resumo.faltas === 1 ? "horário sem aparecer" : "horários sem aparecer"}
            />
            <Numero
              rotulo="Última visita"
              valor={resumo.ultimaVisita ? dataCurta(resumo.ultimaVisita.inicio) : "Nenhuma"}
              detalhe={resumo.ultimaVisita ? resumo.ultimaVisita.servico.nome : "ainda"}
            />
            <div className="col-span-2 min-w-0 border-t border-areia-escura/60 pt-4">
              <dt className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                Próximo horário
              </dt>
              <dd className="mt-1 break-words text-carvao">
                {resumo.proximo ? (
                  <>
                    <span className="font-semibold">
                      {quando(resumo.proximo.inicio)}
                    </span>{" "}
                    · {resumo.proximo.servico.nome}
                  </>
                ) : (
                  <span className="text-carvao-suave">Nada marcado por enquanto.</span>
                )}
              </dd>
            </div>
          </dl>
        </Cartao>
      </Secao>

      {proximos.length > 0 ? (
        <Secao titulo="Próximos horários" explicacao="Toque para abrir o dia na agenda.">
          <ul className="space-y-2.5">
            {proximos.map((atendimento) => (
              <li key={atendimento.id}>
                <Link href={`/painel/agenda?dia=${paraDataLocal(atendimento.inicio)}`} className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{quando(atendimento.inicio)}</p>
                        <p className="mt-0.5 text-sm break-words text-carvao-suave">
                          {atendimento.servico.nome}
                        </p>
                      </div>
                      <p className="shrink-0 font-display font-semibold whitespace-nowrap tabular-nums text-carvao">
                        {emReais(valorDoAtendimento(atendimento))}
                      </p>
                    </div>
                  </Cartao>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao titulo="Atendimentos anteriores">
        {anteriores.length === 0 ? (
          <Vazio
            titulo="Nenhum atendimento ainda"
            texto="Quando ela vier, cada visita aparece aqui, com o serviço e o valor."
            acao={arquivada ? undefined : { rotulo: "Abrir agenda", href: "/painel/agenda" }}
          />
        ) : (
          <>
            <ul className="space-y-2.5">
              {anteriores.map((atendimento) => {
                const situacao = situacaoValida(atendimento.status) ? atendimento.status : null;
                return (
                  <li key={atendimento.id}>
                    <Cartao>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-carvao">
                            {dataCurta(atendimento.inicio)}
                          </p>
                          <p className="mt-0.5 text-sm break-words text-carvao-suave">
                            {atendimento.servico.nome}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {situacao === "concluido" ? (
                            <p className="font-display font-semibold whitespace-nowrap tabular-nums text-carvao">
                              {emReais(valorDoAtendimento(atendimento))}
                            </p>
                          ) : null}
                          <div className={situacao === "concluido" ? "mt-1" : ""}>
                            <Etiqueta tom={situacao ? TOM_DA_SITUACAO[situacao] : "calma"}>
                              {situacao ? ROTULO_DA_SITUACAO[situacao] : atendimento.status}
                            </Etiqueta>
                          </div>
                        </div>
                      </div>
                    </Cartao>
                  </li>
                );
              })}
            </ul>
            {anterioresForaDaLista > 0 ? (
              <p className="text-sm leading-relaxed text-carvao-suave">
                Mostrando os {ANTERIORES_NA_TELA} mais recentes.{" "}
                {anterioresForaDaLista === 1
                  ? "O outro continua guardado"
                  : `Os outros ${anterioresForaDaLista} continuam guardados`}{" "}
                e contando no resumo acima.
              </p>
            ) : null}
          </>
        )}
      </Secao>

      {temCobranca ? (
        abertas.length === 0 && pagas.length === 0 ? (
          <Secao titulo="Cobranças">
            <Vazio
              titulo="Nenhuma cobrança por aqui"
              texto="Quando você cobrar pelo WhatsApp, as cobranças dela aparecem aqui."
              acao={
                arquivada
                  ? undefined
                  : { rotulo: "Cobrar", href: `/painel/cobrancas/nova?cliente=${cliente.id}` }
              }
            />
          </Secao>
        ) : (
          <>
            {abertas.length > 0 ? (
              <Secao titulo="Cobranças em aberto">
                <ListaDeCobrancas cobrancas={abertas} hoje={hoje} />
              </Secao>
            ) : null}
            {pagas.length > 0 ? (
              <Secao titulo="Cobranças pagas">
                <ListaDeCobrancas cobrancas={pagas} hoje={hoje} />
              </Secao>
            ) : null}
          </>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-areia-escura/60 pt-5">
        <Link
          href={arquivada ? "/painel/clientes?arquivadas=1" : "/painel/clientes"}
          className="botao-suave"
        >
          Voltar para a lista
        </Link>
        {!arquivada ? (
          <>
            <form action={mudarLembretesDoCliente}>
              <input type="hidden" name="id" value={cliente.id} />
              <input type="hidden" name="semLembretes" value={cliente.semLembretes ? "0" : "1"} />
              <BotaoEnviar variante="texto">
                {cliente.semLembretes ? "Voltar a enviar lembretes" : "Não enviar lembretes"}
              </BotaoEnviar>
            </form>
            <BotaoTirarDaLista
              id={cliente.id}
              nome={cliente.nome}
              comHistorico={comHistorico}
              horariosMarcados={proximos.length}
              voltarParaLista
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** "qui, 16/10/2026 às 14:00": o dia da semana ajuda a lembrar sem abrir a agenda. */
function quando(data: Date) {
  return `${diaDaSemanaCurto(data)}, ${dataCurta(data)} às ${hora(data)}`;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-medium text-carvao-suave">{rotulo}</dt>
      <dd className="min-w-0 break-words text-carvao">{children}</dd>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
        {rotulo}
      </dt>
      <dd className="mt-1 font-display text-xl font-semibold break-words tabular-nums text-carvao">
        {valor}
      </dd>
      <dd className="mt-0.5 text-xs break-words text-carvao-suave">{detalhe}</dd>
    </div>
  );
}

function ListaDeCobrancas({
  cobrancas,
  hoje,
}: {
  cobrancas: {
    id: string;
    valorCentavos: number;
    vencimento: Date;
    situacao: string;
    pagaEm: Date | null;
    agendamento: { servico: { nome: string } } | null;
  }[];
  hoje: Date;
}) {
  return (
    <ul className="space-y-2.5">
      {cobrancas.map((cobranca) => {
        const naTela = situacaoDaCobranca(cobranca, hoje);
        return (
          <li key={cobranca.id}>
            <Link href={`/painel/cobrancas/${cobranca.id}`} className="block">
              <Cartao className="transition hover:border-terracota/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {/* Cobrança de um horário diz de qual serviço é; a solta, não tem de onde. */}
                    <p className="font-semibold break-words text-carvao">
                      {cobranca.agendamento?.servico.nome ?? "Cobrança avulsa"}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      {naTela === "paga"
                        ? cobranca.pagaEm
                          ? `Paga em ${dataPuraCurta(cobranca.pagaEm)}`
                          : "Paga"
                        : `${prazoPorExtenso(cobranca.vencimento, hoje)} · ${dataPuraCurta(cobranca.vencimento)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display font-semibold whitespace-nowrap tabular-nums text-carvao">
                      {emReais(cobranca.valorCentavos)}
                    </p>
                    <div className="mt-1">
                      <Etiqueta tom={TOM_DA_COBRANCA[naTela]}>{ROTULO_DA_COBRANCA[naTela]}</Etiqueta>
                    </div>
                  </div>
                </div>
              </Cartao>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
