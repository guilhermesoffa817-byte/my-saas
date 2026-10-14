"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cartao, Secao } from "@/componentes/ui/cartao";
import { Aviso, Etiqueta } from "@/componentes/ui/etiqueta";
import { BotaoCopiar } from "@/componentes/ui/botao";
import { gerarLinkDeSenha } from "@/app/acoes/senha";
import { linkDaNovaSenha, mensagemDaNovaSenha } from "@/lib/senha";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";

export type ContaParaSenha = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  nomeNegocio: string;
  pediuEm: string | null;
};

/**
 * Gerar o link de senha nova de uma conta.
 *
 * O código volta uma vez só, aqui na tela, e some assim que a página recarrega:
 * no banco fica apenas o resumo dele. Por isso a tela já monta a mensagem e o
 * botão do WhatsApp, para o caminho inteiro caber em um gesto.
 */
export function Senhas({
  contas,
  enderecoDoSite,
}: {
  contas: ContaParaSenha[];
  enderecoDoSite: string;
}) {
  const [aberto, setAberto] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const navegador = useRouter();

  /*
    Quem pediu quando a tela abriu continua no grupo de cima depois de receber
    o link. Gerar o link fecha o pedido e a lista recarrega; sem esta memória,
    a conta pularia para "Outras contas" levando junto o link que só aparece
    uma vez.
  */
  const [pediramAoAbrir] = useState(
    () => new Set(contas.filter((conta) => conta.pediuEm).map((conta) => conta.id)),
  );

  async function gerar(conta: ContaParaSenha) {
    setErro(null);
    setGerando(conta.id);
    const resultado = await gerarLinkDeSenha(conta.id);
    setGerando(null);

    if (!resultado.certo) {
      setErro(resultado.motivo);
      return;
    }
    setAberto((atual) => ({ ...atual, [conta.id]: resultado.codigo }));
    navegador.refresh();
  }

  const emDestaque = (conta: ContaParaSenha) =>
    Boolean(conta.pediuEm) || pediramAoAbrir.has(conta.id);
  const pediram = contas.filter(emDestaque);
  const outras = contas.filter((conta) => !emDestaque(conta));
  const esperando = pediram.filter((conta) => conta.pediuEm).length;

  function cartaoDaConta(conta: ContaParaSenha) {
    const codigo = aberto[conta.id];
    const link = codigo ? linkDaNovaSenha(enderecoDoSite, codigo) : null;
    const telefone = telefoneParaWhatsApp(conta.telefone);
    const mensagem = link ? mensagemDaNovaSenha({ nome: conta.nome, link }) : null;

    return (
      <li key={conta.id}>
        <Cartao destaque={Boolean(conta.pediuEm)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-carvao">{conta.nomeNegocio}</p>
              <p className="mt-0.5 truncate text-sm text-carvao-suave">
                {conta.nome} · {conta.email}
              </p>
            </div>
            {conta.pediuEm ? (
              <Etiqueta tom="atencao">Pediu em {conta.pediuEm}</Etiqueta>
            ) : null}
          </div>

          {link && mensagem ? (
            <div className="mt-4 space-y-3 rounded-xl border border-terracota/30 bg-terracota/5 p-3">
              <p className="text-xs leading-relaxed text-carvao-suave">
                Este link aparece uma vez só e vale por 30 minutos. Mande agora;
                depois de sair desta tela não dá para vê-lo de novo.
              </p>
              <p className="font-mono text-xs break-all text-carvao-suave select-all">
                {link}
              </p>
              <div className="flex flex-wrap gap-2">
                {telefone.certo ? (
                  <a
                    href={linkDoWhatsApp(telefone.paraWhatsApp, mensagem)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="botao"
                  >
                    Mandar pelo WhatsApp
                  </a>
                ) : null}
                <BotaoCopiar texto={link} rotulo="Copiar o link" />
              </div>
              {!telefone.certo ? (
                <p className="text-xs leading-relaxed text-carvao-suave">
                  {telefone.motivo} Copie o link e mande do jeito que conseguir
                  falar com a pessoa.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                disabled={gerando === conta.id}
                onClick={() => void gerar(conta)}
                className={conta.pediuEm ? "botao" : "botao-suave"}
              >
                {gerando === conta.id ? "Gerando..." : "Gerar link de senha"}
              </button>
            </div>
          )}
        </Cartao>
      </li>
    );
  }

  return (
    <Secao
      titulo="Senhas"
      explicacao="Quem esqueceu a senha pede na tela de entrada e aparece aqui. Gere o link e mande pelo WhatsApp da pessoa."
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {/* Primeiro quem está esperando, separado de todo o resto. */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-carvao">
          {esperando === 0
            ? "Pediram senha nova"
            : esperando === 1
              ? "1 pessoa está esperando o link"
              : `${esperando} pessoas estão esperando o link`}
        </h3>
        {pediram.length > 0 ? (
          <ul className="space-y-3">{pediram.map(cartaoDaConta)}</ul>
        ) : (
          <p className="text-sm text-carvao-suave">Ninguém está esperando link agora.</p>
        )}
      </div>

      {/*
        A lista de todas as contas é longa e empurrava a conferência dos Pix
        para o fim da tela. Fica fechada, a um toque de distância.
      */}
      {outras.length > 0 ? (
        <details className="rounded-2xl border border-areia-escura/70 bg-superficie px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-carvao-suave">
            Outras contas ({outras.length})
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-carvao-suave">
            Para quem pediu a senha nova por outro caminho, como uma mensagem.
          </p>
          <ul className="mt-3 space-y-3">{outras.map(cartaoDaConta)}</ul>
        </details>
      ) : null}
    </Secao>
  );
}
