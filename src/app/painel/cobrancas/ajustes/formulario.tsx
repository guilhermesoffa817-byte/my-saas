"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { MOMENTOS } from "@/lib/cobranca";
import { salvarAjustesDeCobranca, type Resposta } from "../acoes";

export function FormularioDeAjustes({
  pixChave,
  pixCidade,
  lembretes,
  temLembretes,
}: {
  pixChave: string;
  pixCidade: string;
  lembretes: Record<string, boolean>;
  temLembretes: boolean;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(
    salvarAjustesDeCobranca,
    null,
  );
  // A cidade só é exigida quando há chave. Acompanhar a chave aqui deixa o
  // navegador avisar antes de enviar; o servidor confere de novo do mesmo jeito.
  const [temChave, setTemChave] = useState(pixChave.trim() !== "");

  const nomeDoCampo: Record<string, string> = {
    antes: "lembreteAntes",
    no_dia: "lembreteNoDia",
    tres_dias: "lembreteTresDias",
    sete_dias: "lembreteSeteDias",
  };

  return (
    <form action={enviar} className="space-y-7">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <div className="space-y-4">
        <Campo
          nome="pixChave"
          rotulo="Sua chave Pix"
          obrigatorio={false}
          defaultValue={pixChave}
          maxLength={100}
          onChange={(evento) => setTemChave(evento.target.value.trim() !== "")}
          placeholder="(66) 99251-3501"
          dica="Telefone, CPF, CNPJ, e-mail ou chave aleatória, exatamente como no seu banco. É com ela que o código de pagamento é gerado."
        />

        {/*
          Montado à mão, e não com <Campo>, porque o Campo escreveria
          "(opcional)" ao lado, e a cidade não é opcional para quem tem chave.
        */}
        <div>
          <label className="rotulo" htmlFor="pixCidade">
            Cidade de quem recebe
            <span className="font-normal"> (obrigatória se tiver chave Pix)</span>
          </label>
          <input
            id="pixCidade"
            name="pixCidade"
            required={temChave}
            maxLength={60}
            defaultValue={pixCidade}
            placeholder="Cuiabá"
            aria-describedby="pixCidade-dica"
            className="campo"
          />
          <p id="pixCidade-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
            O código Pix exige a cidade junto com o nome. Sem ela, o banco do
            cliente recusa o código.
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="rotulo">Quando o Bossa deve te lembrar de avisar</legend>
        <p className="text-xs leading-relaxed text-carvao-suave">
          Nada é enviado sozinho. O Bossa só mostra, na tela de cobranças, quem
          chegou a hora de avisar. Quem manda a mensagem é você.
        </p>

        {MOMENTOS.map((momento) => (
          <label
            key={momento.codigo}
            className="flex items-center gap-3 rounded-xl border border-areia-escura bg-superficie px-4 py-3"
          >
            <input
              type="checkbox"
              name={nomeDoCampo[momento.codigo]}
              defaultChecked={lembretes[momento.codigo]}
              disabled={!temLembretes}
              className="h-5 w-5 accent-[var(--color-terracota)]"
            />
            <span className="text-sm font-semibold text-carvao">{momento.rotulo}</span>
          </label>
        ))}
      </fieldset>

      <BotaoEnviar className="w-full sm:w-auto" enviando="Salvando...">
        Salvar ajustes
      </BotaoEnviar>
    </form>
  );
}
