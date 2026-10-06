"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { salvarVencimento, type Resposta } from "./acoes";

export function FormularioDeVencimento({ hoje }: { hoje: string }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(salvarVencimento, null);
  const [repete, setRepete] = useState(false);
  const [tipo, setTipo] = useState("conta");

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <fieldset>
        <legend className="rotulo">O que é</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { valor: "conta", rotulo: "Conta a pagar" },
            { valor: "prazo", rotulo: "Prazo de contrato" },
          ].map((opcao) => (
            <label
              key={opcao.valor}
              className="cursor-pointer rounded-xl border border-areia-escura bg-superficie px-4 py-2.5 text-sm font-semibold text-carvao-suave transition has-[:checked]:border-terracota has-[:checked]:bg-terracota has-[:checked]:text-acento-texto"
            >
              <input
                type="radio"
                name="tipo"
                value={opcao.valor}
                defaultChecked={opcao.valor === "conta"}
                onChange={() => setTipo(opcao.valor)}
                className="sr-only"
              />
              {opcao.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo
        nome="descricao"
        rotulo="Descrição"
        placeholder={tipo === "conta" ? "Aluguel do salão" : "Fim do contrato de aluguel"}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="valor"
          rotulo="Valor"
          inputMode="decimal"
          obrigatorio={tipo === "conta"}
          placeholder="800,00"
          dica={tipo === "prazo" ? "Prazo de contrato pode ficar sem valor." : undefined}
        />
        <Campo nome="data" rotulo="Data" tipo="date" defaultValue={hoje} />
      </div>

      <Campo
        nome="categoria"
        rotulo="Categoria"
        obrigatorio={false}
        placeholder="Aluguel, material, energia..."
      />

      <div className="space-y-3">
        <label className="flex items-center gap-3 rounded-xl border border-areia-escura bg-superficie px-4 py-3">
          <input
            type="checkbox"
            name="repete"
            checked={repete}
            onChange={(evento) => setRepete(evento.target.checked)}
            className="h-5 w-5 accent-[var(--color-terracota)]"
          />
          <span className="text-sm font-semibold text-carvao">Repete todo mês</span>
        </label>

        {repete ? (
          <div className="rounded-xl border border-areia-escura bg-areia/40 p-4">
            <Campo
              nome="ate"
              rotulo="Até quando"
              tipo="date"
              obrigatorio={false}
              dica="Deixe em branco se não tem fim combinado. O Bossa mantém sempre os próximos doze meses."
            />
            <p className="mt-3 text-xs leading-relaxed text-carvao-suave">
              O dia escolhido vale como referência: quem vence dia 31 vence dia
              28 em fevereiro, e volta ao 31 em março.
            </p>
          </div>
        ) : null}
      </div>

      <BotaoEnviar className="w-full sm:w-auto" enviando="Guardando...">
        Guardar
      </BotaoEnviar>
    </form>
  );
}
