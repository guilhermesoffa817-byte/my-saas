/**
 * As duas cenas do antes e depois da página de vendas.
 *
 * São desenhadas em HTML e CSS, não são fotos. Isso carrega rápido, acompanha
 * o tema claro e escuro e mostra exatamente a tela do produto, coisa que foto
 * de banco de imagem não faz. Para trocar por foto, basta substituir o miolo de
 * cada cartão por uma <Image /> com o arquivo em /public.
 */

export function CenaAntes() {
  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-areia-escura bg-areia/60 p-5 sm:h-80">
      {/* Caderno rabiscado */}
      <div className="absolute top-6 left-5 w-44 -rotate-3 rounded-lg bg-superficie p-3 shadow-lg sm:w-52">
        <p className="text-[10px] font-semibold tracking-widest text-carvao-suave uppercase">
          Terça
        </p>
        <div className="mt-2 space-y-1.5 text-[11px] text-carvao-suave">
          <p>9h Marina</p>
          <p className="line-through opacity-60">10h Bia</p>
          <p className="font-semibold text-carvao">14h Carla</p>
          <p className="font-semibold text-carvao">14h Juliana ?</p>
          <p className="opacity-60">16h ....</p>
        </div>
      </div>

      {/* Bilhete solto */}
      <div className="absolute top-10 right-6 w-32 rotate-6 rounded-lg bg-rose p-2.5 shadow-md">
        <p className="text-[11px] leading-snug text-carvao">
          remarcar a do sábado!!
        </p>
      </div>

      {/* Conversa esquecida */}
      <div className="absolute right-5 bottom-20 w-44 rounded-xl rounded-br-sm bg-superficie p-3 shadow-lg sm:w-52">
        <p className="text-[11px] leading-snug text-carvao-suave">
          &ldquo;Oi, consegue me encaixar amanhã?&rdquo;
        </p>
        <p className="mt-1.5 text-[10px] text-carvao-suave/70">há 2 dias, sem resposta</p>
      </div>

      {/* Alerta do conflito */}
      <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-superficie px-3 py-2 shadow-lg">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-carvao text-[11px] font-bold text-acento-texto">
          !
        </span>
        <p className="text-[11px] font-semibold text-carvao">Dois clientes às 14h</p>
      </div>
    </div>
  );
}

export function CenaDepois() {
  const horarios = [
    { hora: "09:00", cliente: "Marina Alves", servico: "Atendimento completo" },
    { hora: "11:30", cliente: "Bruno Rocha", servico: "Primeira avaliação" },
    { hora: "14:00", cliente: "Carla Dias", servico: "Manutenção" },
  ];

  return (
    <div className="h-72 overflow-hidden rounded-2xl border border-terracota/30 bg-superficie p-4 shadow-[0_18px_50px_-30px_rgba(11,18,32,0.5)] sm:h-80 sm:p-5">
      {/* Semana, igual ao painel de verdade */}
      <div className="flex items-end justify-between gap-1 rounded-xl bg-areia/70 p-1.5">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((dia, posicao) => (
          <div
            key={dia}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 ${
              posicao === 1 ? "bg-terracota text-acento-texto" : "text-carvao-suave"
            }`}
          >
            <span className="text-[9px] font-semibold uppercase">{dia}</span>
            <span className="text-xs font-semibold tabular-nums">{14 + posicao}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {horarios.map((item) => (
          <div
            key={item.hora}
            className="flex items-center gap-3 rounded-lg border border-areia-escura/70 px-3 py-2"
          >
            <span className="text-xs font-semibold tabular-nums text-terracota">
              {item.hora}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-carvao">{item.cliente}</p>
              <p className="truncate text-[10px] text-carvao-suave">{item.servico}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-terracota px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-acento-texto/80 uppercase">
            Faturamento do mês
          </p>
          <p className="font-display text-lg font-semibold text-acento-texto tabular-nums">
            R$ 4.280,00
          </p>
        </div>
        <p className="text-[10px] leading-tight text-acento-texto/80">
          28 atendimentos
          <br />
          concluídos
        </p>
      </div>
    </div>
  );
}
