"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso, Etiqueta } from "@/componentes/ui/etiqueta";
import { aceitarItem, descartarItem, salvarItem, type Resposta } from "./acoes";

export type ItemNaTela = {
  id: string;
  descricao: string;
  tipo: string;
  valor: string;
  data: string;
  dataBonita: string;
  valorBonito: string;
  repeticao: string | null;
  repeteAte: string | null;
  trecho: string | null;
  pagina: number | null;
  duvidoso: boolean;
  decisao: string | null;
};

/**
 * Um item encontrado no documento, ao lado do trecho de onde ele saiu.
 *
 * O trecho fica à vista de propósito: é ele que deixa a pessoa conferir o que o
 * Bossa leu contra o que está escrito, sem precisar abrir o arquivo.
 */
export function Item({ item }: { item: ItemNaTela }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(salvarItem, null);
  const [editando, setEditando] = useState(false);

  if (item.decisao === "aceito") {
    return (
      <div className="rounded-2xl border border-oliva/30 bg-oliva/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-carvao">{item.descricao}</p>
          <Etiqueta tom="boa">Lançado</Etiqueta>
        </div>
        <p className="mt-1 text-sm text-carvao-suave">
          {item.valorBonito}
          {item.dataBonita ? ` · ${item.dataBonita}` : ""}
          {item.repeticao === "mensal" ? " · todo mês" : ""}
        </p>
      </div>
    );
  }

  if (item.decisao === "descartado") {
    return (
      <div className="rounded-2xl border border-areia-escura bg-areia/30 p-4 opacity-70">
        <p className="font-semibold text-carvao-suave line-through">{item.descricao}</p>
        <p className="mt-0.5 text-sm text-carvao-suave">Descartado</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        item.duvidoso
          ? "border-amber-300/70 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5"
          : "border-areia-escura bg-superficie"
      }`}
    >
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-carvao">{item.descricao}</p>
          <p className="mt-0.5 text-sm text-carvao-suave">
            {item.valorBonito || "sem valor lido"}
            {item.dataBonita ? ` · ${item.dataBonita}` : " · sem data lida"}
            {item.repeticao === "mensal" ? " · todo mês" : ""}
          </p>
        </div>
        {item.duvidoso ? <Etiqueta tom="atencao">Confira este</Etiqueta> : null}
      </div>

      {item.trecho ? (
        <blockquote className="mt-3 rounded-xl border-l-4 border-areia-escura bg-areia/40 px-3 py-2">
          <p className="text-sm leading-relaxed text-carvao-suave italic">
            &ldquo;{item.trecho}&rdquo;
          </p>
          {item.pagina ? (
            <cite className="mt-1 block text-xs not-italic text-carvao-suave/80">
              Página {item.pagina} do documento
            </cite>
          ) : null}
        </blockquote>
      ) : null}

      {editando ? (
        <form action={enviar} className="mt-4 space-y-3 rounded-xl bg-areia/40 p-3">
          <input type="hidden" name="id" value={item.id} />
          <Campo
            nome="descricao"
            idDoCampo={`descricao-${item.id}`}
            rotulo="O que é"
            defaultValue={item.descricao}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              nome="valor"
              idDoCampo={`valor-${item.id}`}
              rotulo="Valor"
              inputMode="decimal"
              obrigatorio={false}
              defaultValue={item.valor}
            />
            <Campo
              nome="data"
              idDoCampo={`data-${item.id}`}
              rotulo="Data"
              tipo="date"
              obrigatorio={false}
              defaultValue={item.data}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <BotaoEnviar enviando="Salvando...">Salvar correção</BotaoEnviar>
            <button type="button" onClick={() => setEditando(false)} className="botao-suave">
              Deixar como está
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {/*
            Sem data o item não pode virar vencimento, e um botão que não faz
            nada é pior do que botão nenhum: a pessoa toca, não acontece nada e
            ela não entende por quê. Aqui o caminho é corrigir a data primeiro.
          */}
          {item.data ? (
            <form action={aceitarItem}>
              <input type="hidden" name="id" value={item.id} />
              <BotaoEnviar enviando="Lançando...">
                {item.repeticao === "mensal" ? "Lançar todo mês" : "Lançar"}
              </BotaoEnviar>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className={item.data ? "botao-suave" : "botao"}
          >
            {item.data ? "Corrigir" : "Preencher a data"}
          </button>
          <form action={descartarItem}>
            <input type="hidden" name="id" value={item.id} />
            <BotaoEnviar variante="texto">Descartar</BotaoEnviar>
          </form>
        </div>
      )}

      {!item.data ? (
        <p className="mt-3 text-xs leading-relaxed text-carvao-suave">
          Sem data, este item não vira vencimento. Corrija a data para poder lançar.
        </p>
      ) : null}
    </div>
  );
}
