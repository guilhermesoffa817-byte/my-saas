import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, situacaoDoUsuario } from "@/lib/guardas";
import { Aviso, Etiqueta } from "@/componentes/avisos";
import { BotaoCopiar } from "@/componentes/botoes";
import { PLANO, pixCopiaECola } from "@/lib/assinatura";
import {
  competenciaPorExtenso,
  dataCurta,
  dataEHora,
  emReais,
} from "@/lib/formato";
import { FormularioAvisoDePagamento } from "./formulario";

export const metadata = { title: "Assinatura — Ateliê" };
export const dynamic = "force-dynamic";

const rotuloStatus = {
  teste: "Período de teste",
  ativa: "Assinatura em dia",
  aguardando: "Conferindo seu Pix",
  expirada: "Assinatura vencida",
} as const;

const rotuloPagamento = {
  aguardando: "Conferindo",
  confirmado: "Confirmado",
  recusado: "Não localizado",
} as const;

export default async function PaginaAssinatura() {
  const usuario = await exigirUsuario();
  const situacao = await situacaoDoUsuario(usuario);

  const pagamentos = await prisma.pagamento.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 12,
  });

  const jaAvisou = pagamentos.some((pagamento) => pagamento.status === "aguardando");

  const copiaECola = pixCopiaECola({
    chave: PLANO.pixChave,
    nome: PLANO.pixNome,
    valorCentavos: PLANO.valorCentavos,
    identificador: "ATELIE",
  });

  const qrCode = await QRCode.toString(copiaECola, {
    type: "svg",
    margin: 1,
    color: { dark: "#2f2722", light: "#ffffff" },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-semibold text-carvao">Sua assinatura</h1>
        <p className="mt-2 max-w-2xl text-carvao-suave">
          {PLANO.nome} por {emReais(PLANO.valorCentavos)} ao mês, pago por Pix. Sem
          fidelidade, sem multa e sem surpresa na fatura.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="cartao">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-carvao">Como está hoje</h2>
            <Etiqueta
              tom={
                situacao.status === "ativa"
                  ? "boa"
                  : situacao.status === "expirada"
                    ? "erro"
                    : "atencao"
              }
            >
              {rotuloStatus[situacao.status]}
            </Etiqueta>
          </div>

          <p className="mt-4 leading-relaxed text-carvao-suave">{situacao.recado}</p>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-areia-escura/60 pb-3">
              <dt className="text-carvao-suave">Plano</dt>
              <dd className="font-semibold text-carvao">{PLANO.nome}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-areia-escura/60 pb-3">
              <dt className="text-carvao-suave">Valor por mês</dt>
              <dd className="font-semibold text-carvao">{emReais(PLANO.valorCentavos)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-carvao-suave">
                {situacao.liberada ? "Vale até" : "Venceu em"}
              </dt>
              <dd className="font-semibold text-carvao">{dataCurta(situacao.validaAte)}</dd>
            </div>
          </dl>

          {situacao.status === "expirada" ? (
            <div className="mt-5">
              <Aviso tom="atencao">
                Seus dados continuam guardados, viu? É só fazer o Pix que tudo volta
                exatamente como você deixou.
              </Aviso>
            </div>
          ) : null}
        </div>

        <div className="cartao">
          <h2 className="font-display text-xl font-semibold text-carvao">
            Pagar com Pix
          </h2>
          <p className="mt-1 text-sm text-carvao-suave">
            Aponte a câmera do banco para o QR Code ou copie a chave abaixo.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            <div
              className="mx-auto w-40 rounded-2xl border border-areia-escura bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />

            <div className="space-y-4">
              <div className="rounded-2xl border border-areia-escura bg-creme px-4 py-3">
                <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
                  Chave Pix (telefone)
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-carvao select-all">
                  {PLANO.pixChave}
                </p>
                <p className="mt-1 text-xs text-carvao-suave">
                  Em nome de {PLANO.pixNome} · {emReais(PLANO.valorCentavos)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <BotaoCopiar texto={PLANO.pixChave} rotulo="Copiar chave" />
                <BotaoCopiar texto={copiaECola} rotulo="Copiar código Pix" />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-areia-escura/60 pt-5">
            <FormularioAvisoDePagamento jaAvisou={jaAvisou} />
          </div>
        </div>
      </section>

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Histórico de pagamentos
        </h2>

        {pagamentos.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-carvao-suave">
            Nenhum pagamento por aqui ainda. Quando você avisar o primeiro Pix, ele aparece
            nesta lista.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {pagamentos.map((pagamento) => (
              <li
                key={pagamento.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-areia-escura/70 bg-creme px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-carvao">
                    {competenciaPorExtenso(pagamento.competencia)} ·{" "}
                    {emReais(pagamento.valorCentavos)}
                  </p>
                  <p className="text-xs text-carvao-suave">
                    Avisado em {dataEHora(pagamento.criadoEm)}
                    {pagamento.observacao ? ` — "${pagamento.observacao}"` : ""}
                  </p>
                </div>
                <Etiqueta
                  tom={
                    pagamento.status === "confirmado"
                      ? "boa"
                      : pagamento.status === "recusado"
                        ? "erro"
                        : "atencao"
                  }
                >
                  {rotuloPagamento[pagamento.status as keyof typeof rotuloPagamento] ??
                    pagamento.status}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
