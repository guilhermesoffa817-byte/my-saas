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

  const pediram = contas.filter((conta) => conta.pediuEm);

  return (
    <Secao
      titulo="Senhas"
      explicacao="Quem esqueceu a senha pede na tela de entrada e aparece aqui. Gere o link e mande pelo WhatsApp da pessoa."
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {pediram.length > 0 ? (
        <p className="text-sm font-semibold text-carvao">
          {pediram.length === 1
            ? "1 pessoa está esperando"
            : `${pediram.length} pessoas estão esperando`}
        </p>
      ) : null}

      <ul className="space-y-3">
        {contas.map((conta) => {
          const codigo = aberto[conta.id];
          const link = codigo ? linkDaNovaSenha(enderecoDoSite, codigo) : null;
          const telefone = telefoneParaWhatsApp(conta.telefone);
          const mensagem = link
            ? mensagemDaNovaSenha({ nome: conta.nome, link })
            : null;

          return (
            <li key={conta.id}>
              <Cartao destaque={Boolean(conta.pediuEm)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-carvao">
                      {conta.nomeNegocio}
                    </p>
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
                      Este link aparece uma vez só e vale por 30 minutos. Mande
                      agora; depois de sair desta tela não dá para vê-lo de novo.
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
                        {telefone.motivo} Copie o link e mande do jeito que
                        conseguir falar com a pessoa.
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
        })}
      </ul>
    </Secao>
  );
}
