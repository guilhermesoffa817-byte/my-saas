"use client";

import { useActionState } from "react";
import { entrar } from "@/app/acoes/autenticacao";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export function FormularioEntrar() {
  const [estado, acao] = useActionState(entrar, null);

  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="rotulo" htmlFor="email">
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="campo"
          placeholder="voce@seuestudio.com.br"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">
          Sua senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
          placeholder="••••••••"
        />
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <BotaoEnviar className="w-full" enviando="Entrando...">
        Entrar no meu painel
      </BotaoEnviar>
    </form>
  );
}
