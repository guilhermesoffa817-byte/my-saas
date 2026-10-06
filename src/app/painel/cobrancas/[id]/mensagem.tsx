"use client";

import { useState } from "react";
import { BotaoCopiar, BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { registrarLembrete } from "../acoes";
import { TONS, type Tom } from "@/lib/cobranca";

/**
 * A mensagem que vai para o WhatsApp.
 *
 * O texto dos três tons é montado no servidor e chega pronto: nada aqui
 * recalcula valor nem data. A pessoa escolhe o tom, pode editar o texto e
 * manda. Na volta, confirma se enviou, porque o Bossa não tem como saber.
 */
export function Mensagem({
  textos,
  tomSugerido,
  linkBase,
  cobrancaId,
  podeLembrar,
  avisoDoLembrete,
}: {
  textos: Record<Tom, string>;
  tomSugerido: Tom;
  linkBase: string | null;
  cobrancaId: string;
  podeLembrar: boolean;
  avisoDoLembrete: string | null;
}) {
  const [tom, setTom] = useState<Tom>(tomSugerido);
  const [texto, setTexto] = useState(textos[tomSugerido]);
  const [mandou, setMandou] = useState(false);

  function trocarTom(novo: Tom) {
    setTom(novo);
    setTexto(textos[novo]);
  }

  const link = linkBase ? `${linkBase}${encodeURIComponent(texto)}` : null;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="rotulo">Tom da mensagem</legend>
        <div className="flex flex-wrap gap-2">
          {TONS.map((opcao) => (
            <button
              key={opcao.codigo}
              type="button"
              onClick={() => trocarTom(opcao.codigo)}
              aria-pressed={tom === opcao.codigo}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tom === opcao.codigo
                  ? "border-terracota bg-terracota text-acento-texto"
                  : "border-areia-escura bg-superficie text-carvao-suave hover:border-terracota/50"
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          {TONS.find((opcao) => opcao.codigo === tom)?.explicacao}
        </p>
      </fieldset>

      <div>
        <label className="rotulo" htmlFor="texto-da-mensagem">
          Mensagem
        </label>
        <textarea
          id="texto-da-mensagem"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          rows={9}
          className="campo font-sans text-sm leading-relaxed"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          Pode editar antes de enviar. O valor, a data e o código Pix foram
          preenchidos pelo Bossa.
        </p>
      </div>

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMandou(true)}
          className="botao w-full"
        >
          Enviar pelo WhatsApp
        </a>
      ) : (
        <Aviso tom="atencao">
          Esse cliente está sem telefone válido na ficha, então não dá para abrir
          o WhatsApp. Você ainda pode copiar a mensagem abaixo e mandar à mão.
        </Aviso>
      )}

      <BotaoCopiar texto={texto} rotulo="Copiar mensagem" className="w-full" />

      {/* A confirmação só aparece depois que a pessoa abriu o WhatsApp. */}
      {mandou && podeLembrar ? (
        <div className="rounded-2xl border border-terracota/30 bg-terracota/5 p-4">
          <p className="text-sm font-semibold text-carvao">Você enviou a mensagem?</p>
          <p className="mt-1 text-xs leading-relaxed text-carvao-suave">
            O Bossa não consegue ver o que sai do seu WhatsApp. Confirmando, ele
            guarda o lembrete e não sugere o mesmo aviso de novo.
          </p>
          <form action={registrarLembrete} className="mt-3">
            <input type="hidden" name="id" value={cobrancaId} />
            <BotaoEnviar className="w-full" enviando="Guardando...">
              Sim, enviei
            </BotaoEnviar>
          </form>
        </div>
      ) : null}

      {mandou && !podeLembrar && avisoDoLembrete ? (
        <Aviso tom="calma">{avisoDoLembrete}</Aviso>
      ) : null}
    </div>
  );
}
