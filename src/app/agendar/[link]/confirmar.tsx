"use client";

import Link from "next/link";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { emReais } from "@/lib/formato";
import type { ResumoDoAgendamento } from "@/lib/agendamento-online/operacoes";
import { confirmarHorario } from "./acoes";

type AoMarcar = (resumo: ResumoDoAgendamento) => void;

const MarcouContexto = createContext<AoMarcar | null>(null);

/**
 * Guarda a confirmação acima dos passos.
 *
 * Os passos são montados no servidor a partir do endereço, e o horário
 * escolhido só aparece enquanto está livre. Depois de marcado, ele deixa de
 * estar livre: se a página fosse montada de novo por qualquer motivo, o
 * formulário (e com ele a confirmação) sumiria e a cliente leria "Esse horário
 * não está mais livre". Guardado aqui, fora dos passos, o resumo fica na tela
 * até ela trocar de endereço ("Marcar outro horário"); a página põe uma `key`
 * com o endereço para isso.
 */
export function FluxoDoAgendamento({ link, children }: { link: string; children: React.ReactNode }) {
  const [resumo, setResumo] = useState<ResumoDoAgendamento | null>(null);
  if (resumo) return <HorarioMarcado resumo={resumo} link={link} />;
  return <MarcouContexto.Provider value={setResumo}>{children}</MarcouContexto.Provider>;
}

/**
 * O último passo: nome e WhatsApp. Quando dá certo, os passos dão lugar ao
 * resumo do horário, ali mesmo, sem trocar de página.
 */
export function ConfirmarHorario({
  link,
  servico,
  quem,
  dia,
  hora,
  nomeNegocio,
  voltarParaHorarios,
}: {
  link: string;
  servico: string;
  quem: string;
  dia: string;
  hora: string;
  nomeNegocio: string;
  voltarParaHorarios: string;
}) {
  const aoMarcar = useContext(MarcouContexto);
  const [estado, acao] = useActionState(confirmarHorario, null);
  const marcado = estado && "ok" in estado ? estado.resumo : null;

  // Antes de pintar a tela: o formulário sai e o resumo entra no mesmo quadro.
  useLayoutEffect(() => {
    if (marcado && aoMarcar) aoMarcar(marcado);
  }, [marcado, aoMarcar]);

  if (marcado) return aoMarcar ? null : <HorarioMarcado resumo={marcado} link={link} />;

  return (
    <form action={acao} className="relative space-y-4">
      <input type="hidden" name="link" value={link} />
      <input type="hidden" name="servico" value={servico} />
      <input type="hidden" name="quem" value={quem} />
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="hora" value={hora} />

      {/*
        Isca para robô: escondida de quem enxerga e de leitor de tela, fora da
        ordem do Tab. Gente nunca preenche; robô preenche tudo o que vê.
      */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="site">Não preencha este campo</label>
        <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <CamposDaCliente nomeNegocio={nomeNegocio} />

      {estado && "erro" in estado ? (
        <div className="space-y-2">
          <Aviso tom="erro">{estado.erro}</Aviso>
          {estado.ocupado ? (
            <Link href={voltarParaHorarios} className="botao-suave w-full">
              Ver outros horários
            </Link>
          ) : null}
        </div>
      ) : null}

      <BotaoEnviar enviando="Confirmando..." className="w-full">
        Confirmar horário
      </BotaoEnviar>
    </form>
  );
}

function CamposDaCliente({ nomeNegocio, desligados = false }: { nomeNegocio: string; desligados?: boolean }) {
  return (
    <>
      <div>
        <label className="rotulo" htmlFor="nome">
          Seu nome
        </label>
        <input
          id="nome"
          name="nome"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="campo"
          placeholder="Juliana Prado"
          disabled={desligados}
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="telefone">
          Seu WhatsApp
        </label>
        <input
          id="telefone"
          name="telefone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          aria-describedby="telefone-dica"
          className="campo"
          placeholder="(11) 98765-4321"
          disabled={desligados}
        />
        <p id="telefone-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          Com DDD. Seu nome e seu WhatsApp vão só para {nomeNegocio}, para
          confirmar e lembrar o horário.
        </p>
      </div>
    </>
  );
}

/**
 * O último passo na página do estúdio de exemplo: os mesmos campos, travados,
 * e no lugar do botão o que aconteceria numa conta de verdade. Nada é enviado.
 */
export function ConfirmarNaDemonstracao({
  nomeNegocio,
  destino,
}: {
  nomeNegocio: string;
  destino: string;
}) {
  return (
    <div className="space-y-4">
      <CamposDaCliente nomeNegocio={nomeNegocio} desligados />
      <div className="rounded-2xl border border-terracota/30 bg-rose px-4 py-3">
        <p className="text-sm leading-relaxed text-carvao">
          Na sua conta, aqui a cliente digita o nome e o WhatsApp, toca em
          &ldquo;Confirmar horário&rdquo; e o horário cai direto na sua agenda. Nesta
          página de exemplo nenhum horário é marcado.
        </p>
        <Link href={destino} className="botao mt-3 w-full sm:w-auto">
          Ver os planos
        </Link>
      </div>
    </div>
  );
}

function HorarioMarcado({ resumo, link }: { resumo: ResumoDoAgendamento; link: string }) {
  const caixa = useRef<HTMLDivElement>(null);

  // A cliente estava lá embaixo, no formulário: o resumo começa no topo.
  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    caixa.current?.scrollIntoView({ block: "start", behavior: reduzir ? "auto" : "smooth" });
    caixa.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={caixa}
      tabIndex={-1}
      className="animar-entrada scroll-mt-4 space-y-5 rounded-2xl border border-areia-escura/70 bg-superficie p-4 outline-none"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracota text-acento-texto"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-carvao">
            Pronto, {resumo.primeiroNome}! Horário marcado.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-carvao-suave">
            {resumo.nomeNegocio} já recebeu o seu horário.
          </p>
        </div>
      </div>

      <dl className="divide-y divide-areia-escura/60 rounded-2xl border border-areia-escura/70 bg-creme">
        <Linha rotulo="Serviço">
          {resumo.servico} · {resumo.duracaoMin} min
        </Linha>
        <Linha rotulo="Quando">{resumo.quando}</Linha>
        {resumo.quem ? <Linha rotulo="Com">{resumo.quem}</Linha> : null}
        <Linha rotulo="Valor">{emReais(resumo.precoCentavos)}</Linha>
        {resumo.endereco ? <Linha rotulo="Endereço">{resumo.endereco}</Linha> : null}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        {resumo.whatsappDoEstudio ? (
          <a
            href={resumo.whatsappDoEstudio}
            target="_blank"
            rel="noopener noreferrer"
            className="botao w-full sm:w-auto"
          >
            Falar com o estúdio no WhatsApp
          </a>
        ) : null}
        <Link href={`/agendar/${link}`} className="botao-suave w-full sm:w-auto">
          Marcar outro horário
        </Link>
      </div>
      <p className="text-xs leading-relaxed text-carvao-suave">
        Precisa mudar ou desmarcar? Fale direto com o estúdio.
      </p>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3">
      <dt className="text-sm text-carvao-suave">{rotulo}</dt>
      <dd className="text-right text-sm font-semibold text-carvao">{children}</dd>
    </div>
  );
}
