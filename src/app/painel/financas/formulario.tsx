"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { salvarImposto, salvarLancamento } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export function FormularioLancamento({
  hoje,
  ultimoDia,
}: {
  hoje: string;
  /** O último dia aceito: o fim do mês atual. */
  ultimoDia: string;
}) {
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
          maxLength={120}
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
          <input
            id="data"
            name="data"
            type="date"
            defaultValue={hoje}
            max={ultimoDia}
            className="campo"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="categoria">
            Categoria <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="categoria"
            name="categoria"
            maxLength={40}
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
    <form action={acao} className="space-y-3">
      <div>
        <label className="rotulo" htmlFor="percentual">
          Percentual
        </label>
        {/* Campo e botão na mesma linha e na mesma altura. */}
        <div className="flex items-stretch gap-2">
          <div className="relative w-24">
            <input
              id="percentual"
              name="percentual"
              inputMode="decimal"
              required
              maxLength={5}
              defaultValue={percentual}
              className="campo pr-8 text-right tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-carvao-suave"
            >
              %
            </span>
          </div>

          <BotaoEnviar variante="suave" enviando="Salvando...">
            Salvar
          </BotaoEnviar>
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}
