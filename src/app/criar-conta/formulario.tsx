"use client";

import { useActionState } from "react";
import { criarConta } from "@/app/acoes/autenticacao";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export function FormularioCriarConta() {
  const [estado, acao] = useActionState(criarConta, null);

  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="nome">
            Como podemos te chamar?
          </label>
          <input
            id="nome"
            name="nome"
            required
            className="campo"
            placeholder="Ana Paula"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="nomeNegocio">
            Nome do seu estúdio
          </label>
          <input
            id="nomeNegocio"
            name="nomeNegocio"
            required
            className="campo"
            placeholder="Estúdio Bela Pele"
            autoComplete="organization"
          />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="campo"
          placeholder="voce@seuestudio.com.br"
          autoComplete="email"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="telefone">
            WhatsApp <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="telefone"
            name="telefone"
            className="campo"
            placeholder="(66) 99251-3501"
            autoComplete="tel"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="senha">
            Crie uma senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={8}
            className="campo"
            placeholder="pelo menos 8 caracteres"
            autoComplete="new-password"
          />
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <BotaoEnviar className="w-full" enviando="Preparando tudo...">
        Criar minha conta
      </BotaoEnviar>

      <p className="text-center text-xs leading-relaxed text-carvao-suave">
        Ao criar a conta você começa no período de teste. Só vamos pedir o Pix quando ele
        terminar — e nunca sem avisar.
      </p>
    </form>
  );
}
