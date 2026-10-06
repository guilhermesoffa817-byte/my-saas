"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/componentes/ui/etiqueta";
import { confirmarEnvio, pedirEnvio } from "./acoes";

type Fase = "parado" | "enviando" | "lendo" | "erro";

/**
 * O envio do arquivo.
 *
 * O arquivo vai do navegador direto para o espaço privado, por um endereço
 * assinado que o servidor gera depois de conferir de quem é. Ele não passa pela
 * função do site, que tem limite de tamanho e de tempo.
 */
export function EnvioDeDocumento({
  limiteMb,
  restam,
}: {
  limiteMb: number;
  restam: number;
}) {
  const [fase, setFase] = useState<Fase>("parado");
  const [recado, setRecado] = useState<string | null>(null);
  const navegador = useRouter();

  async function enviar(arquivo: File) {
    setRecado(null);
    setFase("enviando");

    const pedido = await pedirEnvio({
      nome: arquivo.name,
      tipo: arquivo.type,
      tamanhoBytes: arquivo.size,
    });

    if (!pedido.certo) {
      setRecado(pedido.motivo);
      setFase("erro");
      return;
    }

    const subida = await fetch(pedido.endereco, {
      method: "PUT",
      headers: { "content-type": arquivo.type },
      body: arquivo,
    });

    if (!subida.ok) {
      setRecado("O arquivo não chegou. Confira sua internet e tente de novo.");
      setFase("erro");
      return;
    }

    await confirmarEnvio(pedido.documentoId);
    setFase("lendo");
    navegador.refresh();

    /*
      A leitura é chamada daqui e pode demorar mais do que a hospedagem deixa a
      função viver. Se ela for cortada, o documento fica em "Lendo" e a tela
      oferece "Tentar de novo": nada se perde.
    */
    try {
      await fetch(`/api/documentos/${pedido.documentoId}/ler`, { method: "POST" });
    } catch {
      // Silêncio de propósito: a tela já sabe mostrar o documento parado.
    }
    navegador.refresh();
    setFase("parado");
  }

  return (
    <div className="space-y-3">
      {recado ? <Aviso tom="erro">{recado}</Aviso> : null}

      <label
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-areia-escura bg-areia/30 px-5 py-8 text-center transition hover:border-terracota/60 ${
          fase === "enviando" || fase === "lendo" ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={fase === "enviando" || fase === "lendo"}
          onChange={(evento) => {
            const arquivo = evento.target.files?.[0];
            if (arquivo) void enviar(arquivo);
            evento.target.value = "";
          }}
        />
        <span className="font-display text-lg font-semibold text-carvao">
          {fase === "enviando"
            ? "Enviando o arquivo..."
            : fase === "lendo"
              ? "O Bossa está lendo..."
              : "Enviar um documento"}
        </span>
        <span className="max-w-sm text-sm leading-relaxed text-carvao-suave">
          Um PDF ou uma foto de cada página. Até {limiteMb} MB.
          {restam > 0 ? ` Restam ${restam} leituras neste mês.` : ""}
        </span>
      </label>
    </div>
  );
}
