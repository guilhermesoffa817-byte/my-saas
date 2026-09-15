"use client";

import { useActionState, useEffect, useRef } from "react";
import { salvarServico } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export type ServicoDoFormulario = {
  id: string;
  nome: string;
  preco: string;
  duracaoMin: number;
  descricao: string | null;
};

export function FormularioServico({ servico }: { servico?: ServicoDoFormulario }) {
  const [estado, acao] = useActionState(salvarServico, null);
  const formulario = useRef<HTMLFormElement>(null);
  const novo = !servico;

  useEffect(() => {
    if (estado?.recado && novo) formulario.current?.reset();
  }, [estado, novo]);

  const sufixo = servico?.id ?? "novo";

  return (
    <form ref={formulario} action={acao} className="space-y-4">
      {servico ? <input type="hidden" name="id" value={servico.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="rotulo" htmlFor={`nome-${sufixo}`}>
            Nome do serviço
          </label>
          <input
            id={`nome-${sufixo}`}
            name="nome"
            required
            defaultValue={servico?.nome}
            className="campo"
            placeholder="Limpeza de pele profunda"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`preco-${sufixo}`}>
            Preço (R$)
          </label>
          <input
            id={`preco-${sufixo}`}
            name="preco"
            required
            inputMode="decimal"
            defaultValue={servico?.preco}
            className="campo"
            placeholder="180,00"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`duracao-${sufixo}`}>
            Duração (min)
          </label>
          <input
            id={`duracao-${sufixo}`}
            name="duracaoMin"
            type="number"
            min={5}
            max={600}
            step={5}
            required
            defaultValue={servico?.duracaoMin ?? 60}
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor={`descricao-${sufixo}`}>
          Descrição <span className="font-normal">(opcional)</span>
        </label>
        <input
          id={`descricao-${sufixo}`}
          name="descricao"
          defaultValue={servico?.descricao ?? ""}
          className="campo"
          placeholder="Higienização, extração, máscara calmante"
        />
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Salvando...">
        {servico ? "Salvar alterações" : "Adicionar serviço"}
      </BotaoEnviar>
    </form>
  );
}
