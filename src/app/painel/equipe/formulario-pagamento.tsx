"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import {
  ROTULO_DO_PAGAMENTO,
  categoriaDoPagamento,
  centavosParaCampo,
  type TipoDePagamento,
  type Vinculo,
} from "@/lib/equipe";
import { registrarPagamentoAcao, type Resposta } from "./acoes";

/**
 * Registrar um pagamento já com a conta do combinado no campo. O valor muda
 * quando o tipo muda (salário puxa o fixo, comissão puxa o percentual), mas é
 * sempre editável: o que vale é o que a dona pagou de fato.
 */
export function FormularioDePagamento({
  pessoa,
  tipos,
  tipoSugerido,
  valoresPorTipo,
  competencia,
  rotuloDoMes,
  hoje,
}: {
  pessoa: { id: string; nome: string; vinculo: Vinculo };
  tipos: TipoDePagamento[];
  tipoSugerido: TipoDePagamento;
  valoresPorTipo: Partial<Record<TipoDePagamento, number>>;
  competencia: string;
  rotuloDoMes: string;
  hoje: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(registrarPagamentoAcao, null);
  const [tipo, setTipo] = useState<TipoDePagamento>(tipoSugerido);
  const [valor, setValor] = useState(centavosParaCampo(valoresPorTipo[tipoSugerido] ?? 0));

  function escolherTipo(novo: TipoDePagamento) {
    setTipo(novo);
    setValor(centavosParaCampo(valoresPorTipo[novo] ?? 0));
  }

  const empregada = pessoa.vinculo === "clt" || pessoa.vinculo === "estagio";

  return (
    <details className="w-full">
      <summary className="botao-suave w-full cursor-pointer list-none sm:w-auto">
        Registrar pagamento
      </summary>
      <form
        action={enviar}
        className="mt-3 space-y-4 rounded-xl border border-areia-escura bg-areia/40 p-4"
      >
        <input type="hidden" name="colaboradorId" value={pessoa.id} />
        <input type="hidden" name="competencia" value={competencia} />

        {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
        {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

        <fieldset>
          <legend className="rotulo">Tipo</legend>
          <div className="flex flex-wrap gap-2">
            {tipos.map((opcao) => (
              <label
                key={opcao}
                className="cursor-pointer rounded-xl border border-areia-escura bg-superficie px-3.5 py-2 text-sm font-semibold text-carvao-suave transition has-[:checked]:border-terracota has-[:checked]:bg-terracota has-[:checked]:text-acento-texto"
              >
                <input
                  type="radio"
                  name="tipo"
                  value={opcao}
                  checked={tipo === opcao}
                  onChange={() => escolherTipo(opcao)}
                  className="sr-only"
                />
                {ROTULO_DO_PAGAMENTO[opcao]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nome="valor"
            idDoCampo={`valor-${pessoa.id}`}
            rotulo="Valor pago"
            inputMode="decimal"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            placeholder="0,00"
            dica={
              valoresPorTipo[tipo]
                ? `Conta do combinado em ${rotuloDoMes.toLowerCase()}. Ajuste se pagou diferente.`
                : "Esse tipo não tem conta combinada: digite o valor pago."
            }
          />
          <Campo
            nome="pagoEm"
            idDoCampo={`pagoEm-${pessoa.id}`}
            rotulo="Pago em"
            tipo="date"
            defaultValue={resposta?.campos?.pagoEm ?? hoje}
          />
        </div>

        <div className="space-y-1.5 text-xs leading-relaxed text-carvao-suave">
          <p>
            Entra nas Finanças como saída, em “{categoriaDoPagamento(tipo)}”, referente a{" "}
            {rotuloDoMes.toLowerCase()}. A descrição leva o tipo e o nome abreviado, sem CPF.
          </p>
          {empregada ? (
            <p>
              Use o valor do holerite, do recibo ou da guia que o contador mandou. O valor sugerido
              é o combinado bruto e pode ser diferente do que foi pago.
            </p>
          ) : null}
        </div>

        <BotaoEnviar className="w-full sm:w-auto" enviando="Registrando...">
          Registrar pagamento
        </BotaoEnviar>
      </form>
    </details>
  );
}
