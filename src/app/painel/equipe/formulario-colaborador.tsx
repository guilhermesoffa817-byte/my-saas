"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Area, Campo, Escolha } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import {
  SOBRE_O_VINCULO,
  TERMOS_POR_VINCULO,
  VINCULOS,
  ehVinculo,
  trocaParaVinculoSemEmprego,
  type Vinculo,
} from "@/lib/equipe";
import { salvarColaboradorAcao, type Resposta } from "./acoes";

/** Os valores do formulário, todos em texto, como o campo mostra. */
export type CamposDoColaborador = {
  id: string;
  nome: string;
  cargo: string;
  vinculo: Vinculo;
  inicio: string;
  fim: string;
  salario: string;
  percentual: string;
  porAtendimento: string;
  documento: string;
  pixChave: string;
  telefone: string;
  email: string;
  observacoes: string;
};

export function FormularioDoColaborador({
  inicial,
  hoje,
}: {
  /** Preenchido na edição; vazio no cadastro. */
  inicial: CamposDoColaborador | null;
  hoje: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(salvarColaboradorAcao, null);
  const [vinculo, setVinculo] = useState<Vinculo>(inicial?.vinculo ?? "clt");

  // Depois de um erro, o formulário volta com o que a pessoa tinha digitado.
  const valor = (campo: keyof CamposDoColaborador) =>
    resposta?.campos?.[campo] ?? inicial?.[campo] ?? "";

  const termos = TERMOS_POR_VINCULO[vinculo];
  const editando = Boolean(inicial);

  return (
    <form action={enviar} className="space-y-6">
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Nome" defaultValue={valor("nome")} placeholder="Juliana Prado" autoComplete="off" />
        <Campo
          nome="cargo"
          rotulo="O que faz"
          obrigatorio={false}
          defaultValue={valor("cargo")}
          placeholder="Manicure, recepção, cabeleireira..."
        />
      </div>

      <div className="space-y-2">
        <Escolha
          nome="vinculo"
          rotulo="Vínculo"
          value={vinculo}
          onChange={(evento) => {
            if (ehVinculo(evento.target.value)) setVinculo(evento.target.value);
          }}
          opcoes={VINCULOS.map((opcao) => ({ valor: opcao, rotulo: SOBRE_O_VINCULO[opcao].rotulo }))}
          dica={SOBRE_O_VINCULO[vinculo].descricao}
        />
        <p className="text-xs leading-relaxed text-carvao-suave">
          O Bossa registra o vínculo que você informar. Quem confirma o enquadramento certo é o seu
          contador.
        </p>
        {inicial && trocaParaVinculoSemEmprego(inicial.vinculo, vinculo) ? (
          <Aviso tom="atencao">
            Se essa pessoa já tem férias, faltas, salário ou outro registro de emprego, o vínculo não
            muda: registre o desligamento deste cadastro e cadastre de novo, com o vínculo novo.
          </Aviso>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="inicio" rotulo="Começou em" tipo="date" defaultValue={valor("inicio") || hoje} />
        <Campo
          nome="fim"
          rotulo="Último dia"
          tipo="date"
          obrigatorio={false}
          defaultValue={valor("fim")}
          dica="Só se a pessoa já saiu ou tem data para sair."
        />
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-areia-escura/70 bg-areia/30 p-4">
        <legend className="px-1 text-sm font-semibold text-carvao">O que foi combinado</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {termos.fixo ? (
            <Campo
              nome="salario"
              rotulo={termos.fixo.rotulo}
              obrigatorio={false}
              inputMode="decimal"
              defaultValue={valor("salario")}
              placeholder="1.900,00"
              dica={termos.fixo.ajuda}
            />
          ) : null}
          {termos.percentual ? (
            <Campo
              nome="percentual"
              rotulo={`${termos.percentual.rotulo} (%)`}
              obrigatorio={false}
              inputMode="decimal"
              defaultValue={valor("percentual")}
              placeholder={vinculo === "parceria" ? "60" : "10"}
              dica={termos.percentual.ajuda}
            />
          ) : null}
          {termos.porAtendimento ? (
            <Campo
              nome="porAtendimento"
              rotulo={termos.porAtendimento.rotulo}
              obrigatorio={false}
              inputMode="decimal"
              defaultValue={valor("porAtendimento")}
              placeholder="25,00"
              dica={termos.porAtendimento.ajuda}
            />
          ) : null}
        </div>
        {vinculo === "clt" || vinculo === "estagio" ? (
          <p className="text-xs leading-relaxed text-carvao-suave">
            Salário líquido, descontos e encargos vêm do contador. Aqui fica só o combinado, para
            você acompanhar o que paga.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-carvao">Dados pessoais</legend>
        <p className="-mt-2 text-xs leading-relaxed text-carvao-suave">
          Tudo opcional. Guarde só o que você precisa para pagar e falar com a pessoa. RG, PIS,
          endereço e dependentes ficam com o contador.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nome="documento"
            rotulo="CPF ou CNPJ"
            obrigatorio={false}
            inputMode="numeric"
            defaultValue={valor("documento")}
            placeholder="000.000.000-00"
            autoComplete="off"
          />
          <Campo
            nome="pixChave"
            rotulo="Chave Pix"
            obrigatorio={false}
            defaultValue={valor("pixChave")}
            placeholder="juliana.prado@email.com.br"
            autoComplete="off"
          />
          <Campo
            nome="telefone"
            rotulo="Telefone"
            tipo="tel"
            obrigatorio={false}
            defaultValue={valor("telefone")}
            placeholder="(65) 99251-3501"
            autoComplete="off"
          />
          <Campo
            nome="email"
            rotulo="E-mail"
            tipo="email"
            obrigatorio={false}
            defaultValue={valor("email")}
            placeholder="juliana.prado@email.com.br"
            autoComplete="off"
          />
        </div>
        <Area
          nome="observacoes"
          rotulo="Observações"
          rows={3}
          maxLength={1000}
          defaultValue={valor("observacoes")}
          placeholder="Prefere receber às sextas-feiras."
          dica="Não registre diagnóstico, CID nem detalhes de saúde."
        />
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {editando ? (
          <Link href="/painel/equipe" className="botao-suave">
            Voltar sem salvar
          </Link>
        ) : null}
        <BotaoEnviar enviando="Salvando..." className="w-full sm:w-auto">
          {editando ? "Salvar alterações" : "Cadastrar na equipe"}
        </BotaoEnviar>
      </div>
    </form>
  );
}
