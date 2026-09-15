"use client";

import { useActionState, useEffect, useRef } from "react";
import { salvarCliente } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export type ClienteDoFormulario = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  nascimento: string | null;
  observacoes: string | null;
};

export function FormularioCliente({
  cliente,
  aoSalvar,
}: {
  cliente?: ClienteDoFormulario;
  aoSalvar?: () => void;
}) {
  const [estado, acao] = useActionState(salvarCliente, null);
  const formulario = useRef<HTMLFormElement>(null);
  const novoCadastro = !cliente;

  useEffect(() => {
    if (estado?.recado) {
      if (novoCadastro) formulario.current?.reset();
      aoSalvar?.();
    }
  }, [estado, novoCadastro, aoSalvar]);

  return (
    <form ref={formulario} action={acao} className="space-y-4">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor={`nome-${cliente?.id ?? "nova"}`}>
            Nome
          </label>
          <input
            id={`nome-${cliente?.id ?? "nova"}`}
            name="nome"
            required
            defaultValue={cliente?.nome}
            className="campo"
            placeholder="Marina Alves"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`telefone-${cliente?.id ?? "nova"}`}>
            WhatsApp
          </label>
          <input
            id={`telefone-${cliente?.id ?? "nova"}`}
            name="telefone"
            required
            defaultValue={cliente?.telefone}
            className="campo"
            placeholder="(66) 99251-3501"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor={`email-${cliente?.id ?? "nova"}`}>
            E-mail <span className="font-normal">(opcional)</span>
          </label>
          <input
            id={`email-${cliente?.id ?? "nova"}`}
            name="email"
            type="email"
            defaultValue={cliente?.email ?? ""}
            className="campo"
            placeholder="marina@email.com"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`nascimento-${cliente?.id ?? "nova"}`}>
            Aniversário <span className="font-normal">(opcional)</span>
          </label>
          <input
            id={`nascimento-${cliente?.id ?? "nova"}`}
            name="nascimento"
            type="date"
            defaultValue={cliente?.nascimento ?? ""}
            className="campo"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor={`observacoes-${cliente?.id ?? "nova"}`}>
          Observações <span className="font-normal">(alergias, preferências, o que ela gosta)</span>
        </label>
        <textarea
          id={`observacoes-${cliente?.id ?? "nova"}`}
          name="observacoes"
          rows={3}
          defaultValue={cliente?.observacoes ?? ""}
          className="campo resize-y"
          placeholder="Pele sensível, prefere horários de manhã..."
        />
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Salvando...">
        {cliente ? "Salvar alterações" : "Adicionar cliente"}
      </BotaoEnviar>
    </form>
  );
}
