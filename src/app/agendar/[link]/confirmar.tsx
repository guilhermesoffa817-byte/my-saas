"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { emReais } from "@/lib/formato";
import { confirmarHorario } from "./acoes";

/**
 * O último passo: nome e WhatsApp. Quando dá certo, o formulário vira o
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
  const [estado, acao] = useActionState(confirmarHorario, null);

  if (estado && "ok" in estado) {
    const resumo = estado.resumo;
    return (
      <div className="animar-entrada space-y-5" role="status" aria-live="polite">
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
          <Linha rotulo="Valor">
            {emReais(resumo.precoCentavos)}
          </Linha>
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
        />
        <p id="telefone-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          Com DDD. Seu nome e seu WhatsApp vão só para {nomeNegocio}, para
          confirmar e lembrar o horário.
        </p>
      </div>

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

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3">
      <dt className="text-sm text-carvao-suave">{rotulo}</dt>
      <dd className="text-right text-sm font-semibold text-carvao">{children}</dd>
    </div>
  );
}
