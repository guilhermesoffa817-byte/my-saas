"use client";

import { useActionState } from "react";
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
          placeholder="(66) 99251-3501"
          dica="Telefone, CPF, CNPJ, e-mail ou chave aleatória, exatamente como no seu banco. É com ela que o código de pagamento é gerado."
        />
        <Campo
          nome="pixCidade"
          rotulo="Cidade de quem recebe"
          obrigatorio={false}
          defaultValue={pixCidade}
          placeholder="Cuiabá"
          dica="O código Pix exige a cidade junto com o nome. Sem ela, o banco do cliente recusa o código."
        />
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
