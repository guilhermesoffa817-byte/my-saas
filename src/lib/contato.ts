/**
 * Quem responde pelo Bossa e por onde falar com ele.
 *
 * Os valores vêm das variáveis de ambiente da Netlify, para o dono preencher
 * sem mexer no código. Campo vazio volta `null`, e quem usa omite a frase: a
 * página nunca mostra "[PREENCHER]" nem um nome ou e-mail inventado.
 *
 * Tudo é lido na hora da chamada, e não quando o arquivo carrega. As páginas
 * públicas são montadas no build, então elas acompanham o que estiver
 * preenchido no ambiente da publicação.
 */

import { telefoneBonito } from "@/lib/formato";
import { telefoneParaWhatsApp } from "@/lib/telefone";

function lido(valor: string | undefined) {
  const limpo = (valor ?? "").trim();
  return limpo || null;
}

const EMAIL = /^[^\s@[\]]+@[^\s@]+\.[^\s@]+$/;

export type DadosDoResponsavel = {
  /** Nome completo ou razão social de quem oferece o Bossa. */
  nome: string | null;
  /** CPF ou CNPJ, como foi preenchido. */
  documento: string | null;
  /** O encarregado de dados (LGPD, art. 41). Pode ser a mesma pessoa. */
  encarregado: string | null;
};

/** Quem oferece o Bossa, para os termos e a política de privacidade. */
export function dadosDoResponsavel(): DadosDoResponsavel {
  return {
    nome: lido(process.env.RESPONSAVEL_NOME),
    documento: lido(process.env.RESPONSAVEL_DOCUMENTO),
    encarregado: lido(process.env.ENCARREGADO_DE_DADOS),
  };
}

export type CanalDeContato = { tipo: "email" | "whatsapp"; rotulo: string; href: string };

/**
 * Por onde o cliente fala com o Bossa (suporte, devolução, Pix que demorou).
 * Vem de CONTATO_EMAIL e CONTATO_WHATSAPP. Sem nada preenchido devolve lista
 * vazia, e quem usa deve esconder a frase "é só nos chamar" em vez de
 * prometer um canal que não existe.
 */
export function canaisDeContato(): CanalDeContato[] {
  const canais: CanalDeContato[] = [];
  const email = (process.env.CONTATO_EMAIL ?? "").trim();
  if (EMAIL.test(email)) {
    canais.push({ tipo: "email", rotulo: email, href: `mailto:${email}` });
  }
  const telefone = telefoneParaWhatsApp(process.env.CONTATO_WHATSAPP);
  if (telefone.certo) {
    const local = telefone.paraWhatsApp.slice(2);
    canais.push({ tipo: "whatsapp", rotulo: telefoneBonito(local), href: `https://wa.me/${telefone.paraWhatsApp}` });
  }
  return canais;
}

/**
 * Os canais escritos numa frase, para texto que não vira link (os dados que o
 * Google lê, por exemplo): "pelo e-mail x ou pelo WhatsApp y". Vazio quando
 * não há canal.
 */
export function canaisPorExtenso(canais = canaisDeContato()) {
  return canais
    .map((canal) => (canal.tipo === "email" ? `pelo e-mail ${canal.rotulo}` : `pelo WhatsApp ${canal.rotulo}`))
    .join(" ou ");
}
