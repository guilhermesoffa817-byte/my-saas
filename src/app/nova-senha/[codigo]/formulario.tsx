"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { trocarSenha, type Resposta } from "@/app/acoes/senha";

export function FormularioDeNovaSenha({ codigo }: { codigo: string }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(trocarSenha, null);

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}

      <input type="hidden" name="codigo" value={codigo} />

      <Campo
        nome="senha"
        rotulo="Senha nova"
        tipo="password"
        autoComplete="new-password"
        minLength={8}
        dica="Pelo menos 8 caracteres."
      />
      <Campo
        nome="repetida"
        rotulo="Repita a senha"
        tipo="password"
        autoComplete="new-password"
        minLength={8}
      />

      <BotaoEnviar className="w-full" enviando="Trocando...">
        Salvar a senha nova
      </BotaoEnviar>
    </form>
  );
}
