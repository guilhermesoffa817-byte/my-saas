"use client";

import { useState } from "react";
import { BotaoCopiar } from "@/componentes/ui/botao";
import { FormularioAvisoDePagamento } from "./formulario";
import type { CodigoPlano, FamiliaDoPlano } from "@/lib/assinatura";

export type OpcaoDePlano = {
  codigo: CodigoPlano;
  nome: string;
  familia: FamiliaDoPlano;
  periodo: string;
  valor: string;
  dias: number;
  /** A etiqueta curta no botão do plano ("Economize R$ 378,00"). */
  selo: string | null;
  vantagens: string[];
  /** É o plano pago que está valendo hoje. */
  atual: boolean;
  /** O que este Pix faz se for confirmado hoje, já com a regra de troca de plano. */
  previsao: string;
  /** O QR Code já vem desenhado do servidor, um para cada valor. */
  qrCode: string;
  copiaECola: string;
};

export function PagamentoPix({
  opcoes,
  pixNome,
  planoInicial,
  planoAvisado,
  planoAtual,
  contato,
}: {
  opcoes: OpcaoDePlano[];
  pixNome: string;
  /** O plano de hoje ou o do Pix avisado. Sem nenhum dos dois, nada vem marcado. */
  planoInicial: CodigoPlano | null;
  /** O plano do aviso de Pix que está esperando conferência, se houver. */
  planoAvisado: CodigoPlano | null;
  /** O plano pago valendo hoje, para explicar a troca. */
  planoAtual: { nome: string; familia: FamiliaDoPlano } | null;
  /** Os links de contato, montados no servidor. Vazio quando não há canal. */
  contato: React.ReactNode;
}) {
  const [codigo, definirCodigo] = useState<CodigoPlano | null>(planoInicial);
  const escolhida = opcoes.find((opcao) => opcao.codigo === codigo) ?? null;
  const trocaDeFamilia = Boolean(
    escolhida && planoAtual && escolhida.familia !== planoAtual.familia,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {opcoes.map((opcao) => {
          const ativa = opcao.codigo === escolhida?.codigo;
          const avisado = opcao.codigo === planoAvisado;

          return (
            <button
              key={opcao.codigo}
              type="button"
              onClick={() => definirCodigo(opcao.codigo)}
              aria-pressed={ativa}
              className={`rounded-2xl border p-4 text-left transition motion-reduce:transition-none ${
                ativa
                  ? "border-terracota bg-terracota/10 ring-2 ring-terracota/25"
                  : "border-areia-escura bg-creme hover:border-terracota/60"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-carvao">{opcao.nome}</span>
                {opcao.selo ? (
                  <span className="etiqueta bg-terracota text-acento-texto">{opcao.selo}</span>
                ) : null}
              </span>
              <span className="mt-2 block font-display text-2xl font-semibold text-carvao">
                {opcao.valor}
              </span>
              <span className="block text-xs text-carvao-suave">{opcao.periodo}</span>
              {opcao.atual || avisado ? (
                <span className="mt-2 block text-xs font-semibold text-terracota">
                  {[opcao.atual ? "Seu plano hoje" : null, avisado ? "Pix avisado" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {planoAtual ? (
        <p className="text-sm leading-relaxed text-carvao-suave">
          Trocar de plano não faz você perder o que já pagou: os dias que faltam no plano de
          hoje viram crédito em dinheiro, e esse crédito vira dias a mais no plano novo.
        </p>
      ) : null}

      {escolhida ? (
        <>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            <div
              className="mx-auto w-40 rounded-2xl border border-areia-escura bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: escolhida.qrCode }}
            />

            <div className="space-y-4">
              <div className="rounded-2xl border border-areia-escura bg-creme px-4 py-3">
                <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                  Pix Copia e Cola
                </p>
                <p className="mt-2 font-mono text-xs leading-relaxed break-all text-carvao-suave select-all">
                  {escolhida.copiaECola}
                </p>
                <p className="mt-2 text-xs text-carvao-suave">
                  Em nome de {pixNome || "a confirmar"} · {escolhida.nome} · {escolhida.valor}
                </p>
              </div>

              <BotaoCopiar texto={escolhida.copiaECola} rotulo="Copiar código Pix" />

              {escolhida.vantagens.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-carvao-suave">
                  {escolhida.vantagens.map((vantagem) => (
                    <li key={vantagem} className="flex gap-2">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota"
                        aria-hidden
                      />
                      {vantagem}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="border-t border-areia-escura/60 pt-5">
            {trocaDeFamilia && planoAtual ? (
              <p className="mb-4 rounded-2xl border border-terracota/30 bg-terracota/10 px-4 py-3 text-sm leading-relaxed text-carvao">
                Você está trocando do {planoAtual.nome} para o {escolhida.nome}.{" "}
                {escolhida.previsao}
              </p>
            ) : null}
            {/* A chave do formulário reinicia o aviso ao trocar de plano. */}
            <FormularioAvisoDePagamento
              key={escolhida.codigo}
              plano={escolhida.codigo}
              nomeDoPlano={escolhida.nome}
              planoAvisado={planoAvisado}
              previsao={trocaDeFamilia ? null : escolhida.previsao}
              contato={contato}
            />
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-areia-escura bg-creme px-4 py-6 text-center text-sm leading-relaxed text-carvao-suave">
          Toque no plano que você quer para ver o QR Code e o código Pix.
        </p>
      )}
    </div>
  );
}
