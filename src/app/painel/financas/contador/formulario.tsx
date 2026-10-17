"use client";

import { useActionState } from "react";
import { BotaoConfirmar, BotaoCopiar, BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { gerarLinkDoContador, revogarLinkDoContador, type RespostaDoLink } from "./acoes";

/** O link aparece uma vez, logo depois de gerado. Recarregar a tela apaga. */
export function GerarLink({ temLink }: { temLink: boolean }) {
  const [estado, acao] = useActionState<RespostaDoLink, FormData>(
    async () => gerarLinkDoContador(),
    null,
  );

  return (
    <div className="space-y-4">
      <form action={acao}>
        {temLink ? (
          <BotaoConfirmar
            variante="suave"
            pergunta="Gerar outro link? O link atual para de funcionar na hora, e você precisa mandar o novo para o contador."
          >
            Gerar outro link
          </BotaoConfirmar>
        ) : (
          <BotaoEnviar enviando="Gerando...">Gerar link do contador</BotaoEnviar>
        )}
      </form>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.link ? (
        <div className="space-y-3 rounded-2xl border border-terracota/40 bg-terracota/5 p-4">
          <p className="text-sm font-semibold text-carvao">
            Copie agora e mande para o contador. Por segurança, este link não aparece de novo.
          </p>
          <p className="break-all rounded-xl bg-superficie px-3 py-2 font-mono text-sm text-carvao">
            {estado.link}
          </p>
          <BotaoCopiar texto={estado.link} rotulo="Copiar link" copiado="Link copiado" />
        </div>
      ) : estado?.recado ? (
        <Aviso tom="boa">{estado.recado}</Aviso>
      ) : null}
    </div>
  );
}

export function RevogarLink() {
  const [estado, acao] = useActionState<RespostaDoLink, FormData>(
    async () => revogarLinkDoContador(),
    null,
  );
  return (
    <form action={acao} className="space-y-3">
      <BotaoConfirmar
        variante="texto"
        pergunta="Desligar o link do contador? Ele deixa de abrir na hora."
        className="text-rose-700 dark:text-rose-300"
      >
        Desligar o link
      </BotaoConfirmar>
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}
