"use client";

import { useActionState, useState } from "react";
import { Campo, Escolha } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { AUSENCIAS_POR_VINCULO, ROTULO_DA_AUSENCIA, type Vinculo } from "@/lib/equipe";
import { registrarAusenciaAcao, type Resposta } from "./acoes";

/**
 * Os tipos mudam conforme a pessoa escolhida: estágio tem recesso, e quem não
 * é empregada só fica "indisponível". A tela nem oferece a palavra errada; o
 * servidor confere de novo, porque a tela não é garantia.
 */
export function FormularioDeAusencia({
  pessoas,
  dia,
}: {
  pessoas: { id: string; nome: string; vinculo: Vinculo }[];
  dia: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(registrarAusenciaAcao, null);
  const [pessoaId, setPessoaId] = useState(pessoas[0]?.id ?? "");
  const pessoa = pessoas.find((item) => item.id === pessoaId) ?? pessoas[0];
  const tipos = pessoa ? AUSENCIAS_POR_VINCULO[pessoa.vinculo] : [];
  const [tipo, setTipo] = useState<string>(tipos[0] ?? "");
  const tipoValido = tipos.includes(tipo as (typeof tipos)[number]) ? tipo : tipos[0];

  const valor = (campo: string, padrao: string) => resposta?.campos?.[campo] ?? padrao;

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <Escolha
        nome="colaboradorId"
        rotulo="Quem"
        value={pessoa?.id ?? ""}
        onChange={(evento) => setPessoaId(evento.target.value)}
        opcoes={pessoas.map((item) => ({ valor: item.id, rotulo: item.nome }))}
      />

      <fieldset>
        <legend className="rotulo">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {tipos.map((opcao) => (
            <label
              key={opcao}
              className="cursor-pointer rounded-xl border border-areia-escura bg-superficie px-4 py-2.5 text-sm font-semibold text-carvao-suave transition has-[:checked]:border-terracota has-[:checked]:bg-terracota has-[:checked]:text-acento-texto"
            >
              <input
                type="radio"
                name="tipo"
                value={opcao}
                checked={tipoValido === opcao}
                onChange={() => setTipo(opcao)}
                className="sr-only"
              />
              {ROTULO_DA_AUSENCIA[opcao]}
            </label>
          ))}
        </div>
        {tipos.length === 1 ? (
          <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
            Quem não é empregada não tem férias, folga nem falta: fica só indisponível na agenda.
            Registrar essas palavras para prestadora pode virar prova de vínculo de emprego.
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="inicio" rotulo="Primeiro dia" tipo="date" defaultValue={valor("inicio", dia)} />
        <Campo nome="fim" rotulo="Último dia" tipo="date" defaultValue={valor("fim", dia)} />
      </div>

      {tipoValido === "atestado" ? (
        <p className="text-xs leading-relaxed text-carvao-suave">
          Atestado entra só como período. Não registre diagnóstico, CID nem detalhes de saúde: o
          documento fica com você e com o contador.
        </p>
      ) : null}

      <BotaoEnviar className="w-full sm:w-auto" enviando="Registrando...">
        Registrar ausência
      </BotaoEnviar>
    </form>
  );
}
