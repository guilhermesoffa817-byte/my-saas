"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { salvarImposto, salvarLancamento } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export function FormularioLancamento({ hoje }: { hoje: string }) {
  const [estado, acao] = useActionState(salvarLancamento, null);
  const [tipo, definirTipo] = useState<"entrada" | "saida">("saida");
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.recado) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={acao} className="space-y-4">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["saida", "Saiu dinheiro"],
            ["entrada", "Entrou dinheiro"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => definirTipo(valor)}
            aria-pressed={tipo === valor}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tipo === valor
                ? "border-terracota bg-terracota/10 text-carvao ring-2 ring-terracota/25"
                : "border-areia-escura text-carvao-suave hover:border-terracota/60"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">
          Do que se trata?
        </label>
        <input
          id="descricao"
          name="descricao"
          required
          className="campo"
          placeholder={tipo === "saida" ? "Aluguel da sala" : "Venda de produto"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="valor">
            Valor
          </label>
          <input
            id="valor"
            name="valor"
            required
            inputMode="decimal"
            className="campo"
            placeholder="150,00"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="data">
            Data
          </label>
          <input id="data" name="data" type="date" defaultValue={hoje} className="campo" />
        </div>

        <div>
          <label className="rotulo" htmlFor="categoria">
            Categoria <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="categoria"
            name="categoria"
            className="campo"
            placeholder="Material"
            list="categorias-sugeridas"
          />
          <datalist id="categorias-sugeridas">
            <option value="Aluguel" />
            <option value="Material" />
            <option value="Energia e água" />
            <option value="Marketing" />
            <option value="Transporte" />
            <option value="Retirada pessoal" />
          </datalist>
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Registrando...">Registrar lançamento</BotaoEnviar>
    </form>
  );
}

export function FormularioImposto({ percentual }: { percentual: number }) {
  const [estado, acao] = useActionState(salvarImposto, null);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <div className="w-28">
        <label className="rotulo" htmlFor="percentual">
          Percentual
        </label>
        <input
          id="percentual"
          name="percentual"
          inputMode="decimal"
          defaultValue={percentual}
          className="campo"
        />
      </div>

      <BotaoEnviar variante="suave" enviando="Salvando...">
        Salvar
      </BotaoEnviar>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}
