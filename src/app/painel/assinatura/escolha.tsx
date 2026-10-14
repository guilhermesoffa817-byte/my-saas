"use client";

import { useState } from "react";
import { BotaoCopiar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";
import { FormularioAvisoDePagamento } from "./formulario";
import type { CodigoPlano } from "@/lib/assinatura";

export type OpcaoDePlano = {
  codigo: CodigoPlano;
  nome: string;
  periodo: string;
  /** Quanto o plano anual sai por mês, para comparar com o mensal. */
  porMes: string | null;
  /** Planos que abrem a aba Finanças. */
  financeiro: boolean;
  valor: string;
  dias: number;
  vantagens: string[];
  /** O QR Code já vem desenhado do servidor, um para cada valor. */
  qrCode: string;
  copiaECola: string;
};

export function PagamentoPix({
  opcoes,
  inicial,
  atual,
  pixNome,
  jaAvisou,
}: {
  opcoes: OpcaoDePlano[];
  /** Onde a escolha começa: o plano de hoje, para quem renova sem mexer em nada. */
  inicial: CodigoPlano;
  /** O plano pago que está valendo. Vazio no teste grátis. */
  atual: CodigoPlano | null;
  pixNome: string;
  jaAvisou: boolean;
}) {
  const [codigo, definirCodigo] = useState<CodigoPlano>(inicial);
  const escolhida = opcoes.find((opcao) => opcao.codigo === codigo) ?? opcoes[0];
  const deHoje = opcoes.find((opcao) => opcao.codigo === atual);
  const trocando = deHoje && deHoje.codigo !== escolhida.codigo;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {opcoes.map((opcao) => {
          const ativa = opcao.codigo === escolhida.codigo;

          return (
            <button
              key={opcao.codigo}
              type="button"
              onClick={() => definirCodigo(opcao.codigo)}
              aria-pressed={ativa}
              className={`rounded-2xl border p-4 text-left transition ${
                ativa
                  ? "border-terracota bg-terracota/10 ring-2 ring-terracota/25"
                  : "border-areia-escura bg-creme hover:border-terracota/60"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-carvao">{opcao.nome}</span>
                {opcao.vantagens.length > 0 ? (
                  <span className="etiqueta bg-terracota text-acento-texto">
                    {opcao.vantagens[0]}
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block font-display text-2xl font-semibold text-carvao">
                {opcao.valor}
              </span>
              <span className="block text-xs text-carvao-suave">
                {opcao.periodo}
                {opcao.porMes ? ` · sai a ${opcao.porMes} por mês` : ""}
                {opcao.codigo === atual ? " · seu plano hoje" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Trocar de plano é escolha, nunca descuido: a tela diz o que muda. */}
      {trocando ? (
        deHoje.financeiro && !escolhida.financeiro ? (
          <Aviso tom="atencao">
            Hoje você está no {deHoje.nome}. Com o {escolhida.nome}, a aba Finanças
            fecha quando o Pix for confirmado.
          </Aviso>
        ) : (
          <Aviso>
            Hoje você está no {deHoje.nome}. Com este Pix, você passa para o{" "}
            {escolhida.nome}.
          </Aviso>
        )
      ) : null}

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
              Em nome de {pixNome || "a confirmar"} · {escolhida.valor} · acesso por {escolhida.dias} dias
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
        {/* A chave do formulário reinicia o aviso ao trocar de plano. */}
        <FormularioAvisoDePagamento
          key={escolhida.codigo}
          jaAvisou={jaAvisou}
          plano={escolhida.codigo}
          dias={escolhida.dias}
        />
      </div>
    </div>
  );
}
