"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Janela } from "@/componentes/ui/janela";
import { Icone } from "@/componentes/ui/icones";
import { Aviso } from "@/componentes/ui/etiqueta";
import {
  lerEventos,
  MAX_VOLTAS,
  TAMANHO_MAXIMO_DA_PERGUNTA,
  type ConversaDaLista,
  type CotaDoAssistente,
  type EventoAssistente,
  type FonteDaResposta,
  type MensagemDaTela,
  type PedidoAoAssistente,
} from "@/lib/assistente/protocolo";
import { apagarConversa } from "./acoes";
import { FontesDaResposta, TextoDaResposta } from "./resposta";

export const PERGUNTAS_PRONTAS = [
  "Como foi meu último mês?",
  "Quais serviços mais deram resultado nos últimos 3 meses?",
  "Em que dia da semana a agenda fica mais vazia?",
  "Quanto preciso faturar por mês para cobrir os custos fixos?",
  "O que está em alta no meu ramo na minha cidade e vale a pena oferecer?",
];

const RODAPE =
  "Sugestões geradas por IA podem conter erros. Confira os números e fale com seu contador antes de decisões sobre impostos.";

/**
 * Uma mensagem na tela. Na resposta, `texto` é o que já ficou gravado e
 * `parcial` é a volta que está chegando agora: se ela não for gravada (erro,
 * recusa, outra aba), só o pedaço dela some.
 */
type Mensagem = MensagemDaTela & {
  parcial?: string;
  fontesParciais?: FonteDaResposta[];
  erro?: string;
  emAndamento?: boolean;
};

let sequencia = 0;
const idLocal = () => `local-${++sequencia}`;

function juntar(texto: string, parcial: string | undefined) {
  const pedaco = (parcial ?? "").trim();
  if (!pedaco) return texto;
  return texto ? `${texto}\n\n${pedaco}` : pedaco;
}

function rolagemSuave() {
  return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dataDaLista(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Resultado de um pedido (uma volta). */
type Volta =
  | { tipo: "fim"; continuar: boolean }
  | { tipo: "cortado" }
  | { tipo: "parado" }
  | { tipo: "falhou" };

export function ChatDoAssistente({
  conversaInicial,
  perguntaInicial,
  conversas: conversasIniciais,
  cota: cotaInicial,
}: {
  conversaInicial: { id: string; mensagens: MensagemDaTela[] } | null;
  /** Vinda do endereço (?pergunta=): preenche o campo, sem enviar sozinha. */
  perguntaInicial: string | null;
  conversas: ConversaDaLista[];
  cota: CotaDoAssistente | null;
}) {
  const router = useRouter();
  const [conversaId, setConversaId] = useState<string | null>(conversaInicial?.id ?? null);
  const [mensagens, setMensagens] = useState<Mensagem[]>(conversaInicial?.mensagens ?? []);
  const [conversas, setConversas] = useState(conversasIniciais);
  const [cota, setCota] = useState(cotaInicial);
  const [pergunta, setPergunta] = useState(perguntaInicial ?? "");
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [apagando, setApagando] = useState<ConversaDaLista | null>(null);
  const [erroAoApagar, setErroAoApagar] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();

  const controlador = useRef<AbortController | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const registro = useRef<HTMLDivElement>(null);
  /** A conversa em uso, sem esperar o próximo render (o laço de voltas lê daqui). */
  const conversaAtual = useRef<string | null>(conversaInicial?.id ?? null);

  const esgotada = cota !== null && cota.usados >= cota.limite;

  // Sair da página no meio da resposta para o pedido. A pergunta fica gravada
  // e pode ser continuada depois.
  useEffect(() => () => controlador.current?.abort(), []);

  // Pergunta vinda do endereço: campo focado, cursor no fim, e o parâmetro sai
  // do endereço (recarregar não traz a pergunta de volta).
  useEffect(() => {
    if (!perguntaInicial) return;
    const el = campo.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    window.history.replaceState(null, "", "/painel/assistente");
  }, [perguntaInicial]);

  // Acompanha a resposta enquanto ela chega.
  useEffect(() => {
    const el = registro.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: rolagemSuave() ? "smooth" : "auto" });
  }, [mensagens, status]);

  function mudar(id: string, mudanca: (m: Mensagem) => Mensagem) {
    setMensagens((lista) => lista.map((m) => (m.id === id ? mudanca(m) : m)));
  }

  /** Um pedido ao servidor: no máximo uma chamada à IA, com o texto chegando aos poucos. */
  async function umaVolta(pedido: PedidoAoAssistente, idResposta: string, sinal: AbortSignal): Promise<Volta> {
    // Muda dentro do leitor de eventos: num objeto, para o TypeScript não presumir o valor inicial.
    const chegou: { fim: Volta | null } = { fim: null };
    try {
      const resposta = await fetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pedido),
        signal: sinal,
      });
      if (!resposta.ok || !resposta.body) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; codigo?: string };
        mudar(idResposta, (m) => ({
          ...m,
          erro: corpo.erro ?? "Não foi possível falar com o assistente. Tente de novo.",
        }));
        if (corpo.codigo === "consentimento" || corpo.codigo === "plano" || corpo.codigo === "sessao") router.refresh();
        return { tipo: "falhou" };
      }

      await lerEventos(resposta.body, (evento: EventoAssistente) => {
        switch (evento.tipo) {
          case "inicio":
            conversaAtual.current = evento.conversaId;
            setConversaId(evento.conversaId);
            if (evento.nova) {
              setConversas((lista) => [
                { id: evento.conversaId, titulo: evento.titulo, atualizadaEm: new Date().toISOString() },
                ...lista,
              ]);
              window.history.replaceState(null, "", `/painel/assistente?c=${evento.conversaId}`);
            }
            break;
          case "status":
            setStatus(evento.mensagem);
            break;
          case "texto":
            setStatus(null);
            mudar(idResposta, (m) => ({ ...m, parcial: (m.parcial ?? "") + evento.delta }));
            break;
          case "fonte":
            mudar(idResposta, (m) => {
              const todas = [...m.fontes, ...(m.fontesParciais ?? [])];
              if (todas.some((f) => f.url === evento.url)) return m;
              return { ...m, fontesParciais: [...(m.fontesParciais ?? []), { url: evento.url, titulo: evento.titulo }] };
            });
            break;
          case "recusa":
            // A resposta recusada some inteira: nem a tela nem o histórico ficam com ela.
            mudar(idResposta, (m) => ({ ...m, texto: "", parcial: "", fontes: [], fontesParciais: [], aviso: evento.mensagem }));
            break;
          case "aviso":
            mudar(idResposta, (m) => ({ ...m, aviso: evento.mensagem }));
            break;
          case "erro":
            mudar(idResposta, (m) => ({ ...m, erro: evento.mensagem, podeContinuar: evento.repetivel }));
            break;
          case "fim":
            if (evento.cota) setCota(evento.cota);
            mudar(idResposta, (m) =>
              evento.salvo
                ? {
                    ...m,
                    texto: juntar(m.texto, m.parcial),
                    parcial: "",
                    fontes: [...m.fontes, ...(m.fontesParciais ?? [])],
                    fontesParciais: [],
                  }
                : { ...m, parcial: "", fontesParciais: [] },
            );
            if (evento.salvo) {
              const atual = conversaAtual.current;
              setConversas((lista) =>
                lista.map((c) => (c.id === atual ? { ...c, atualizadaEm: new Date().toISOString() } : c)),
              );
            }
            chegou.fim = { tipo: "fim", continuar: evento.continuar };
            break;
        }
      });
      if (chegou.fim) return chegou.fim;
      // Sem o "fim": a conexão caiu ou a hospedagem cortou o pedido no meio.
      mudar(idResposta, (m) => ({ ...m, parcial: "", fontesParciais: [] }));
      return { tipo: "cortado" };
    } catch (erro) {
      mudar(idResposta, (m) => ({ ...m, parcial: "", fontesParciais: [] }));
      if (erro instanceof DOMException && erro.name === "AbortError") return { tipo: "parado" };
      return chegou.fim ?? { tipo: "cortado" };
    }
  }

  /**
   * Conduz as voltas de uma pergunta: pede, grava e pede de novo enquanto o
   * servidor disser que falta. Um corte no meio é tentado de novo uma vez,
   * porque o servidor retoma da última volta gravada.
   */
  async function conduzir(primeiro: PedidoAoAssistente, idResposta: string) {
    setEnviando(true);
    setStatus("Preparando a análise…");
    mudar(idResposta, (m) => ({ ...m, emAndamento: true, erro: undefined, podeContinuar: false }));
    const abortar = new AbortController();
    controlador.current = abortar;

    let pedido = primeiro;
    let cortes = 0;
    try {
      for (let pedidos = 0; pedidos < MAX_VOLTAS + 4; pedidos++) {
        const volta = await umaVolta(pedido, idResposta, abortar.signal);
        if (volta.tipo === "falhou") return;
        if (volta.tipo === "parado") {
          mudar(idResposta, (m) => ({ ...m, aviso: "Você parou a resposta.", podeContinuar: true }));
          return;
        }
        const conversa = conversaAtual.current;
        if (volta.tipo === "cortado") {
          if (cortes < 1 && conversa) {
            cortes += 1;
            setStatus("A conexão caiu. Retomando…");
            pedido = { acao: "continuar", conversaId: conversa };
            continue;
          }
          mudar(idResposta, (m) => ({
            ...m,
            erro: "A resposta demorou mais do que o servidor permite e parou no meio.",
            podeContinuar: Boolean(conversa),
          }));
          return;
        }
        if (!volta.continuar || !conversa) return;
        cortes = 0;
        setStatus("Analisando…");
        pedido = { acao: "continuar", conversaId: conversa };
      }
    } finally {
      controlador.current = null;
      mudar(idResposta, (m) => ({ ...m, emAndamento: false }));
      setEnviando(false);
      setStatus(null);
      campo.current?.focus();
    }
  }

  function enviar(texto: string) {
    const limpa = texto.trim();
    if (!limpa || enviando || esgotada) return;
    const idResposta = idLocal();
    // Uma resposta que ficou pela metade é encerrada pelo servidor ao chegar a nova pergunta.
    setMensagens((lista) => [
      ...lista.map((m) => (m.podeContinuar ? { ...m, podeContinuar: false } : m)),
      { id: idLocal(), papel: "usuario", texto: limpa, fontes: [] },
      { id: idResposta, papel: "assistente", texto: "", fontes: [] },
    ]);
    setPergunta("");
    // O botão acionado some neste render: o foco vai para o campo, de onde o Tab chega ao "Parar".
    requestAnimationFrame(() => campo.current?.focus());
    const conversa = conversaAtual.current;
    void conduzir(
      conversa ? { acao: "perguntar", conversaId: conversa, pergunta: limpa } : { acao: "perguntar", pergunta: limpa },
      idResposta,
    );
  }

  function continuarResposta(idResposta: string) {
    const conversa = conversaAtual.current;
    if (!conversa || enviando) return;
    mudar(idResposta, (m) => ({ ...m, aviso: undefined }));
    void conduzir({ acao: "continuar", conversaId: conversa }, idResposta);
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    enviar(pergunta);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar(pergunta);
    }
  }

  function confirmarApagar(conversa: ConversaDaLista) {
    setErroAoApagar(null);
    iniciar(async () => {
      const dados = new FormData();
      dados.set("id", conversa.id);
      const resposta = await apagarConversa(null, dados);
      if (resposta?.erro) {
        setErroAoApagar(resposta.erro);
        return;
      }
      setApagando(null);
      setConversas((lista) => lista.filter((c) => c.id !== conversa.id));
      if (conversa.id === conversaAtual.current) {
        conversaAtual.current = null;
        setConversaId(null);
        setMensagens([]);
        router.push("/painel/assistente");
      }
    });
  }

  const lista =
    conversas.length === 0 ? (
      <p className="px-1 text-sm text-carvao-suave">Nenhuma conversa ainda.</p>
    ) : (
      <ul className="space-y-1">
        {conversas.map((c) => (
          <li key={c.id} className="flex items-center gap-1">
            <Link
              href={`/painel/assistente?c=${c.id}`}
              aria-current={c.id === conversaId ? "page" : undefined}
              aria-disabled={enviando || undefined}
              onClick={(e) => {
                if (enviando) e.preventDefault();
              }}
              className={`flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl px-3 py-1.5 text-sm transition hover:bg-areia/70 ${
                c.id === conversaId ? "bg-areia font-semibold text-terracota" : "text-carvao"
              }`}
            >
              <span className="truncate">{c.titulo}</span>
              <span className="text-xs tabular-nums text-carvao-suave">{dataDaLista(c.atualizadaEm)}</span>
            </Link>
            <button
              type="button"
              className="botao-texto min-h-11 text-carvao-suave hover:text-rose-700"
              aria-label={`Apagar a conversa "${c.titulo}"`}
              disabled={enviando || processando}
              onClick={() => {
                setErroAoApagar(null);
                setApagando(c);
              }}
            >
              Apagar
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-3" aria-label="Conversas">
        <Link
          href="/painel/assistente"
          className="botao-suave w-full justify-start"
          aria-disabled={enviando || undefined}
          onClick={(e) => {
            if (enviando) {
              e.preventDefault();
              return;
            }
            conversaAtual.current = null;
            setConversaId(null);
            setMensagens([]);
          }}
        >
          + Nova conversa
        </Link>
        <details className="rounded-2xl border border-areia-escura/70 bg-superficie p-2 lg:hidden">
          <summary className="cursor-pointer px-2 py-2 text-sm font-semibold text-carvao">
            Conversas anteriores ({conversas.length})
          </summary>
          <div className="pt-2">{lista}</div>
        </details>
        <div className="hidden lg:block">
          <p className="px-1 pb-2 text-xs font-semibold tracking-widest text-carvao-suave uppercase">
            Conversas anteriores
          </p>
          {lista}
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-col rounded-2xl border border-areia-escura/70 bg-superficie shadow-[0_10px_40px_-28px_rgba(11,18,32,0.5)]"
        aria-label="Conversa com o assistente"
      >
        <div
          ref={registro}
          role="log"
          aria-live="polite"
          aria-busy={enviando}
          aria-label="Mensagens da conversa"
          className="flex h-[min(62dvh,42rem)] min-h-80 flex-col gap-4 overflow-y-auto p-4 sm:p-5"
        >
          {mensagens.length === 0 ? (
            <div className="m-auto max-w-xl space-y-4 text-center">
              <Icone nome="conversa" className="mx-auto h-8 w-8 text-terracota" />
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold text-carvao">
                  O que você quer saber sobre o seu negócio?
                </h2>
                <p className="text-sm leading-relaxed text-carvao-suave">
                  Escolha uma pergunta pronta ou escreva a sua. O assistente olha as suas finanças, a agenda, os
                  serviços e os custos antes de responder.
                </p>
              </div>
              <ul className="space-y-2">
                {PERGUNTAS_PRONTAS.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className="botao-suave h-auto w-full justify-start py-2.5 text-left font-medium whitespace-normal"
                      disabled={enviando || esgotada}
                      onClick={() => enviar(p)}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            mensagens.map((m) =>
              m.papel === "usuario" ? (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl bg-areia px-4 py-3 text-sm text-carvao">
                  <span className="sr-only">Você perguntou: </span>
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                </div>
              ) : (
                <div
                  key={m.id}
                  className="max-w-full rounded-2xl border border-areia-escura/70 bg-creme px-4 py-3 text-sm text-carvao"
                >
                  <span className="sr-only">Resposta do assistente: </span>
                  {juntar(m.texto, m.parcial) ? <TextoDaResposta texto={juntar(m.texto, m.parcial)} /> : null}
                  {m.emAndamento && !juntar(m.texto, m.parcial) ? (
                    <p className="text-carvao-suave" aria-hidden>
                      …
                    </p>
                  ) : null}
                  <FontesDaResposta fontes={[...m.fontes, ...(m.fontesParciais ?? [])]} />
                  {m.aviso ? <p className="mt-3 text-xs leading-relaxed text-carvao-suave">{m.aviso}</p> : null}
                  {m.erro ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{m.erro}</p> : null}
                  {m.podeContinuar && !m.emAndamento ? (
                    <button
                      type="button"
                      className="botao-texto -ml-3 mt-1"
                      disabled={enviando}
                      onClick={() => continuarResposta(m.id)}
                    >
                      {m.erro ? "Tentar de novo" : "Continuar a resposta"}
                    </button>
                  ) : null}
                </div>
              ),
            )
          )}
        </div>

        <p role="status" className="min-h-7 px-4 text-sm text-carvao-suave sm:px-5">
          {status ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-terracota border-t-transparent motion-reduce:animate-none"
                aria-hidden
              />
              {status}
            </span>
          ) : null}
        </p>

        <form onSubmit={aoEnviar} className="space-y-2 border-t border-areia-escura/70 p-4 sm:px-5">
          {esgotada && cota ? (
            <Aviso tom="atencao">
              Você já usou as {cota.limite} perguntas do mês. A franquia renova no dia 1º.
            </Aviso>
          ) : null}
          <label htmlFor="pergunta-assistente" className="rotulo">
            Sua pergunta
          </label>
          <textarea
            id="pergunta-assistente"
            ref={campo}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={aoTeclar}
            maxLength={TAMANHO_MAXIMO_DA_PERGUNTA}
            rows={2}
            disabled={esgotada}
            placeholder="Ex.: Quanto entrou e quanto saiu em setembro, comparado com agosto?"
            aria-describedby="pergunta-assistente-ajuda"
            className="campo max-h-48"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="pergunta-assistente-ajuda" className="text-xs text-carvao-suave">
              Enter envia; Shift+Enter pula linha.
              {cota ? (
                <>
                  {" "}
                  <span className="tabular-nums">
                    {cota.usados} de {cota.limite}
                  </span>{" "}
                  perguntas usadas neste mês.
                </>
              ) : null}
            </p>
            {enviando ? (
              <button type="button" className="botao-suave" onClick={() => controlador.current?.abort()}>
                Parar
              </button>
            ) : (
              <button type="submit" className="botao" disabled={esgotada || !pergunta.trim()}>
                Enviar
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-carvao-suave">{RODAPE}</p>
        </form>
      </section>

      <Janela
        aberta={apagando !== null}
        titulo="Apagar esta conversa?"
        texto={apagando ? `"${apagando.titulo}" e todas as respostas dela saem do Bossa. Não dá para desfazer.` : undefined}
        perigo
        aoFechar={() => setApagando(null)}
        confirmar={
          <button
            type="button"
            className="botao-perigo w-full sm:w-auto"
            disabled={processando}
            onClick={() => apagando && confirmarApagar(apagando)}
          >
            {processando ? "Apagando..." : "Apagar conversa"}
          </button>
        }
      >
        {erroAoApagar ? <Aviso tom="erro">{erroAoApagar}</Aviso> : null}
      </Janela>
    </div>
  );
}
