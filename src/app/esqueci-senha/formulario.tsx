"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { pedirNovaSenha, type Resposta } from "@/app/acoes/senha";

export function FormularioDeRecuperacao() {
  const [resposta, enviar] = useActionState<Resposta, FormData>(pedirNovaSenha, null);

  if (resposta?.recado) {
    return <Aviso tom="boa">{resposta.recado}</Aviso>;
  }

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}

      <Campo
        nome="email"
        rotulo="Seu e-mail"
        tipo="email"
        autoComplete="email"
        placeholder="voce@seuestudio.com.br"
        dica="O mesmo que você usa para entrar."
      />

      <BotaoEnviar className="w-full" enviando="Enviando...">
        Pedir uma senha nova
      </BotaoEnviar>
    </form>
  );
}
