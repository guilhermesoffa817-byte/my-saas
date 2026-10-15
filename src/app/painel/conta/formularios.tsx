"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import {
  excluirMinhaConta,
  salvarDadosDaConta,
  trocarSenhaDaConta,
  type Resposta,
} from "./acoes";
import {
  PALAVRA_DE_EXCLUSAO,
  TAMANHO_MINIMO_DA_SENHA,
  mudaAPortaDeEntrada,
} from "./regras";

export type DadosIniciais = {
  nome: string;
  nomeNegocio: string;
  email: string;
  telefone: string;
  documento: string;
  cep: string;
  endereco: string;
};

export function FormularioDosDados({ inicial }: { inicial: DadosIniciais }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(salvarDadosDaConta, null);

  // Depois de um erro, o formulário volta com o que foi digitado, e não com o
  // que estava salvo: ninguém precisa preencher tudo de novo por causa de um CEP.
  const valor = (campo: keyof DadosIniciais) =>
    resposta?.valores?.[campo] ?? inicial[campo];

  /*
    A senha atual só é pedida quando o e-mail ou o WhatsApp mudam. O campo
    aparece na hora em que a pessoa mexe num dos dois, para ela não descobrir
    isso só depois de tocar em salvar. Quem decide de verdade é o servidor.
    Depois de salvar, o que está salvo passa a ser o digitado, e o campo some.
  */
  const [porta, setPorta] = useState({
    email: inicial.email,
    telefone: inicial.telefone,
  });
  const pedeSenha = mudaAPortaDeEntrada(inicial, porta);

  function acompanharPorta(evento: React.FormEvent<HTMLFormElement>) {
    const campos = evento.currentTarget.elements;
    setPorta({
      email: (campos.namedItem("email") as HTMLInputElement | null)?.value ?? "",
      telefone: (campos.namedItem("telefone") as HTMLInputElement | null)?.value ?? "",
    });
  }

  return (
    <form action={enviar} onChange={acompanharPorta} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          nome="nome"
          rotulo="Seu nome"
          defaultValue={valor("nome")}
          autoComplete="name"
          maxLength={80}
        />
        <Campo
          nome="nomeNegocio"
          rotulo="Nome do seu estúdio"
          defaultValue={valor("nomeNegocio")}
          autoComplete="organization"
          maxLength={80}
          dica="Vai em toda cobrança por Pix e em toda mensagem de WhatsApp que você manda pelo Bossa."
        />
      </div>

      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        defaultValue={valor("email")}
        autoComplete="email"
        maxLength={120}
        dica="É com ele que você entra no Bossa."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          nome="telefone"
          rotulo="WhatsApp"
          tipo="tel"
          defaultValue={valor("telefone")}
          autoComplete="tel"
          placeholder="(66) 99251-3501"
          dica="É por ele que mandamos o link quando você esquece a senha. Deixe sempre em dia."
        />
        <Campo
          nome="documento"
          rotulo="CPF ou CNPJ"
          defaultValue={valor("documento")}
          inputMode="numeric"
          placeholder="000.000.000-00"
          dica="Identifica a sua assinatura na hora do pagamento."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,10rem)_1fr]">
        <Campo
          nome="cep"
          rotulo="CEP"
          obrigatorio={false}
          defaultValue={valor("cep")}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="78000-000"
        />
        <Campo
          nome="endereco"
          rotulo="Endereço do estúdio"
          obrigatorio={false}
          defaultValue={valor("endereco")}
          autoComplete="street-address"
          maxLength={200}
          placeholder="Rua das Flores, 120, Centro, Cuiabá/MT"
        />
      </div>

      {pedeSenha ? (
        <div className="rounded-2xl border border-terracota/30 bg-terracota/5 p-4">
          <Campo
            nome="senhaAtual"
            idDoCampo="senha-para-dados"
            rotulo="Sua senha atual"
            tipo="password"
            autoComplete="current-password"
            dica="O e-mail e o WhatsApp são as portas de entrada da sua conta. Para mudar um deles, confirme que é você."
          />
        </div>
      ) : null}

      <BotaoEnviar className="w-full sm:w-auto" enviando="Salvando...">
        Salvar meus dados
      </BotaoEnviar>
    </form>
  );
}

export function FormularioDaSenha() {
  const [resposta, enviar] = useActionState<Resposta, FormData>(trocarSenhaDaConta, null);

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <Campo
        nome="senhaAtual"
        idDoCampo="senha-atual"
        rotulo="Senha atual"
        tipo="password"
        autoComplete="current-password"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          nome="senhaNova"
          rotulo="Senha nova"
          tipo="password"
          autoComplete="new-password"
          minLength={TAMANHO_MINIMO_DA_SENHA}
          placeholder={`pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres`}
        />
        <Campo
          nome="repetida"
          rotulo="Repita a senha nova"
          tipo="password"
          autoComplete="new-password"
          minLength={TAMANHO_MINIMO_DA_SENHA}
        />
      </div>

      <BotaoEnviar className="w-full sm:w-auto" enviando="Trocando...">
        Trocar a senha
      </BotaoEnviar>
    </form>
  );
}

export function FormularioDeExclusao() {
  const [resposta, enviar] = useActionState<Resposta, FormData>(excluirMinhaConta, null);

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}

      <Campo
        nome="senhaAtual"
        idDoCampo="senha-para-excluir"
        rotulo="Sua senha"
        tipo="password"
        autoComplete="current-password"
      />

      <Campo
        nome="confirmacao"
        rotulo={`Escreva ${PALAVRA_DE_EXCLUSAO} para confirmar`}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={PALAVRA_DE_EXCLUSAO}
      />

      <BotaoEnviar variante="perigo" className="w-full sm:w-auto" enviando="Excluindo...">
        Excluir minha conta para sempre
      </BotaoEnviar>
    </form>
  );
}
