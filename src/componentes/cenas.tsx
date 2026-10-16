import { emReais } from "@/lib/formato";

/**
 * A cena da página de vendas: um dia de trabalho na tela Início.
 *
 * É desenhada em HTML e CSS, não é foto nem ilustração. Carrega rápido,
 * acompanha o tema claro e escuro e mostra, num relance, quatro coisas que o
 * Bossa faz de verdade: a agenda (com um horário que chegou pelo link), a
 * cobrança pronta para o WhatsApp, a conta que vence e o que sobrou no mês.
 *
 * Os valores ficam em centavos, como em todo o sistema, e só viram texto na
 * hora de mostrar.
 */

const HORARIOS = [
  { hora: "09:00", cliente: "Marina Alves", servico: "Escova e hidratação", peloLink: false },
  { hora: "10:30", cliente: "Camila Rocha", servico: "Design de sobrancelha", peloLink: true },
  { hora: "14:00", cliente: "Patrícia Lima", servico: "Manicure e pedicure", peloLink: false },
];

const COBRANCA_CENTAVOS = 12000;
const CONTA_CENTAVOS = 18640;
const SOBROU_CENTAVOS = 438000;

export function CenaDoDia() {
  return (
    <div
      role="img"
      aria-label="Exemplo da tela Início do Bossa: três horários do dia, uma cobrança pronta para enviar no WhatsApp, uma conta que vence amanhã e quanto sobrou no mês."
      className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-areia-escura bg-superficie p-4 shadow-[0_24px_60px_-36px_rgba(11,18,32,0.55)] sm:p-5"
    >
      <div aria-hidden className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-base font-semibold text-carvao">Hoje</p>
          <p className="text-xs text-carvao-suave">terça-feira</p>
        </div>

        <ul className="space-y-1.5">
          {HORARIOS.map((item) => (
            <li
              key={item.hora}
              className="flex items-center gap-3 rounded-xl border border-areia-escura/70 px-3 py-2"
            >
              <span className="text-xs font-semibold tabular-nums text-terracota">{item.hora}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-carvao">
                  {item.cliente}
                </span>
                <span className="block truncate text-xs text-carvao-suave">{item.servico}</span>
              </span>
              {item.peloLink ? (
                <span className="shrink-0 rounded-full bg-rose px-2 py-0.5 text-[11px] font-semibold text-terracota">
                  pelo link
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-areia/70 px-3 py-2.5">
          <p className="text-xs text-carvao-suave">Cobrar hoje</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-carvao">
              Juliana Prado · <span className="tabular-nums">{emReais(COBRANCA_CENTAVOS)}</span>
            </p>
            <span className="shrink-0 rounded-lg bg-terracota px-2.5 py-1 text-[11px] font-semibold text-acento-texto">
              Enviar com Pix
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-areia-escura/70 px-3 py-2.5">
          <p className="text-sm text-carvao">
            Conta de luz <span className="text-carvao-suave">· vence amanhã</span>
          </p>
          <p className="text-sm font-semibold tabular-nums text-carvao">{emReais(CONTA_CENTAVOS)}</p>
        </div>

        <div className="flex items-end justify-between gap-2 border-t border-areia-escura/70 pt-3">
          <p className="text-xs text-carvao-suave">Sobrou em outubro</p>
          <p className="font-display text-xl font-semibold tabular-nums text-carvao">
            {emReais(SOBROU_CENTAVOS)}
          </p>
        </div>
      </div>
    </div>
  );
}
