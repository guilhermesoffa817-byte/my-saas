"use client";

import { useActionState, useState } from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { ligarOuDesligar, salvarAgendaOnline } from "./acoes";

export type FaixaDoFormulario = { diaDaSemana: number; inicio: string; fim: string };

/** Segunda primeiro: é como a semana do estúdio é vivida. */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0];
const NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const INTERVALOS_POR_DIA = 6;

type Intervalo = { chave: number; inicio: string; fim: string };

let proximaChave = 0;
const novaChave = () => ++proximaChave;

/**
 * Os horários de atendimento, dia por dia. Cada dia abre e fecha num toque e
 * aceita mais de um intervalo (manhã e tarde, com o almoço no meio). O que vai
 * para o servidor são campos escondidos "dia|início|fim", um por intervalo.
 */
function EditorDeHorarios({ inicial }: { inicial: FaixaDoFormulario[] }) {
  const [semana, setSemana] = useState<Record<number, Intervalo[]>>(() => {
    const mapa: Record<number, Intervalo[]> = {};
    for (const dia of ORDEM_DOS_DIAS) mapa[dia] = [];
    for (const faixa of inicial) {
      mapa[faixa.diaDaSemana].push({ chave: novaChave(), inicio: faixa.inicio, fim: faixa.fim });
    }
    return mapa;
  });

  function mudar(dia: number, intervalos: Intervalo[]) {
    setSemana((atual) => ({ ...atual, [dia]: intervalos }));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="rotulo">Horários de atendimento</legend>
      <p className="-mt-1 mb-2 text-xs leading-relaxed text-carvao-suave">
        O cliente só vê horário dentro destes intervalos. Para fechar no almoço,
        use dois intervalos no mesmo dia.
      </p>

      {ORDEM_DOS_DIAS.map((dia) => {
        const intervalos = semana[dia];
        const aberto = intervalos.length > 0;
        return (
          <div key={dia} className="rounded-xl border border-areia-escura/70 bg-creme px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-carvao">
                <input
                  type="checkbox"
                  checked={aberto}
                  onChange={(evento) =>
                    mudar(
                      dia,
                      evento.target.checked
                        ? [{ chave: novaChave(), inicio: "09:00", fim: "18:00" }]
                        : [],
                    )
                  }
                  className="h-5 w-5 accent-terracota"
                />
                {NOMES[dia]}
              </label>
              {aberto ? null : <span className="text-xs text-carvao-suave">Fechado</span>}
            </div>

            {aberto ? (
              <ul className="mt-3 space-y-2">
                {intervalos.map((intervalo, posicao) => (
                  <li key={intervalo.chave} className="flex flex-wrap items-center gap-2">
                    <input
                      type="hidden"
                      name="faixa"
                      value={`${dia}|${intervalo.inicio}|${intervalo.fim}`}
                    />
                    <label className="sr-only" htmlFor={`inicio-${intervalo.chave}`}>
                      {NOMES[dia]}, começo do intervalo {posicao + 1}
                    </label>
                    <input
                      id={`inicio-${intervalo.chave}`}
                      type="time"
                      required
                      value={intervalo.inicio}
                      onChange={(evento) =>
                        mudar(
                          dia,
                          intervalos.map((item) =>
                            item.chave === intervalo.chave ? { ...item, inicio: evento.target.value } : item,
                          ),
                        )
                      }
                      className="campo w-auto flex-1 py-2"
                    />
                    <span className="text-sm text-carvao-suave">até</span>
                    <label className="sr-only" htmlFor={`fim-${intervalo.chave}`}>
                      {NOMES[dia]}, fim do intervalo {posicao + 1}
                    </label>
                    <input
                      id={`fim-${intervalo.chave}`}
                      type="time"
                      required
                      value={intervalo.fim}
                      onChange={(evento) =>
                        mudar(
                          dia,
                          intervalos.map((item) =>
                            item.chave === intervalo.chave ? { ...item, fim: evento.target.value } : item,
                          ),
                        )
                      }
                      className="campo w-auto flex-1 py-2"
                    />
                    {intervalos.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          mudar(
                            dia,
                            intervalos.filter((item) => item.chave !== intervalo.chave),
                          )
                        }
                        className="botao-texto px-2"
                        aria-label={`Tirar o intervalo ${posicao + 1} de ${NOMES[dia]}`}
                      >
                        Tirar
                      </button>
                    ) : null}
                  </li>
                ))}
                {intervalos.length < INTERVALOS_POR_DIA ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        const ultimo = intervalos[intervalos.length - 1];
                        mudar(dia, [
                          ...intervalos,
                          { chave: novaChave(), inicio: ultimo?.fim ?? "13:00", fim: "18:00" },
                        ]);
                      }}
                      className="botao-texto px-0"
                    >
                      + Outro intervalo
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

export function FormularioDaAgenda({
  link,
  prefixo,
  faixas,
  antecedenciaMin,
  diasAFrente,
  antecedencias,
  servicos,
  equipe,
}: {
  link: string;
  prefixo: string;
  faixas: FaixaDoFormulario[];
  antecedenciaMin: number;
  diasAFrente: number;
  antecedencias: { valor: number; rotulo: string }[];
  servicos: { id: string; nome: string; detalhe: string; marcado: boolean }[];
  equipe: { escolherQuemAtende: boolean; donaAtende: boolean; pessoas: number } | null;
}) {
  const [estado, acao] = useActionState(salvarAgendaOnline, null);

  return (
    <form action={acao} className="space-y-6">
      <div>
        <label className="rotulo" htmlFor="link">
          Endereço do seu link
        </label>
        <div className="flex items-stretch overflow-hidden rounded-xl border border-areia-escura bg-superficie focus-within:border-terracota focus-within:ring-2 focus-within:ring-terracota/25">
          <span className="hidden items-center bg-areia/60 px-3 text-sm text-carvao-suave sm:flex">
            {prefixo}
          </span>
          <input
            id="link"
            name="link"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={link}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="link-dica"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-carvao outline-none"
          />
        </div>
        <p id="link-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          De 3 a 40 caracteres: letras sem acento, números e hífen. Se você
          trocar depois, o link antigo para de funcionar.
        </p>
      </div>

      <EditorDeHorarios inicial={faixas} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="antecedenciaMin">
            Antecedência mínima
          </label>
          <select
            id="antecedenciaMin"
            name="antecedenciaMin"
            defaultValue={String(antecedenciaMin)}
            aria-describedby="antecedencia-dica"
            className="campo"
          >
            {antecedencias.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
          <p id="antecedencia-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
            Para ninguém marcar um horário daqui a dez minutos.
          </p>
        </div>
        <div>
          <label className="rotulo" htmlFor="diasAFrente">
            Até quantos dias à frente
          </label>
          <input
            id="diasAFrente"
            name="diasAFrente"
            type="number"
            min={1}
            max={180}
            required
            defaultValue={diasAFrente}
            className="campo"
          />
        </div>
      </div>

      <fieldset>
        <legend className="rotulo">Serviços que aparecem no link</legend>
        {servicos.length === 0 ? (
          <p className="text-sm text-carvao-suave">
            Você ainda não tem serviço ativo. Cadastre em Serviços.
          </p>
        ) : (
          <ul className="space-y-2">
            {servicos.map((servico) => (
              <li key={servico.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-areia-escura/70 bg-superficie px-3 py-2.5">
                  <input
                    type="checkbox"
                    name="servico"
                    value={servico.id}
                    defaultChecked={servico.marcado}
                    className="h-5 w-5 shrink-0 accent-terracota"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-carvao">{servico.nome}</span>
                    <span className="block text-xs text-carvao-suave">{servico.detalhe}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {equipe ? (
        <fieldset className="space-y-2">
          <legend className="rotulo">Equipe</legend>
          {equipe.pessoas === 0 ? (
            <p className="text-xs leading-relaxed text-carvao-suave">
              Ninguém cadastrado na Equipe ainda: enquanto isso, todo horário vai
              para a sua agenda.
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-carvao">
            <input
              type="checkbox"
              name="escolherQuemAtende"
              defaultChecked={equipe.escolherQuemAtende}
              className="mt-0.5 h-5 w-5 shrink-0 accent-terracota"
            />
            <span>
              O cliente escolhe quem atende
              <span className="block text-xs text-carvao-suave">
                Mostra o primeiro nome de cada pessoa da equipe, com &quot;Tanto faz&quot;.
                Respeita a agenda e as ausências de cada uma. Desligado, todo
                horário pelo link cai na sua agenda e você distribui.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-carvao">
            <input
              type="checkbox"
              name="donaAtende"
              defaultChecked={equipe.donaAtende}
              className="mt-0.5 h-5 w-5 shrink-0 accent-terracota"
            />
            <span>
              Eu também atendo pelo link
              <span className="block text-xs text-carvao-suave">
                Vale quando o cliente escolhe quem atende.
              </span>
            </span>
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="donaAtende" value="on" />
      )}

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Salvando..." className="w-full sm:w-auto">
        Salvar configuração
      </BotaoEnviar>
    </form>
  );
}

/** Liga ou desliga a página, com o motivo quando não dá para ligar. */
export function BotaoLigar({ ligada }: { ligada: boolean }) {
  const [estado, acao] = useActionState(ligarOuDesligar, null);
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="ligar" value={ligada ? "nao" : "sim"} />
      <BotaoEnviar variante={ligada ? "suave" : "cheio"} enviando="Um instante..." className="w-full sm:w-auto">
        {ligada ? "Desligar a página" : "Colocar a página no ar"}
      </BotaoEnviar>
      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}
