"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { pedirNovaSenha, type Resposta } from "@/app/acoes/senha";

/**
 * `contato` são os canais do Bossa, montados no servidor. Sem nenhum canal
 * preenchido, vem vazio, e a tela não manda ninguém "falar com a gente".
 */
export function FormularioDeRecuperacao({ contato }: { contato?: React.ReactNode }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(pedirNovaSenha, null);

  if (resposta?.recado) {
    return (
      <div className="space-y-3">
        <Aviso tom="boa">{resposta.recado}</Aviso>
        {contato ? (
          <p className="text-sm leading-relaxed text-carvao-suave">
            Se o link demorar, fale com a gente: {contato}
          </p>
        ) : null}
      </div>
    );
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
        defaultValue={resposta?.campos?.email}
        dica="O mesmo que você usa para entrar."
      />

      <BotaoEnviar className="w-full" enviando="Enviando...">
        Pedir uma senha nova
      </BotaoEnviar>
    </form>
  );
}
