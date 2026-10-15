import type { Metadata } from "next";
import Link from "next/link";
import { DIAS_DE_TESTE, PLANOS, type Plano } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { LEITURAS_POR_MES_NO_VIP } from "@/lib/recursos";
import { NOME_DO_PRODUTO, testeLiberaOVip } from "@/lib/site";
import {
  Contatos,
  Item,
  Itens,
  NaTela,
  PaginaLegal,
  QuemResponde,
  Trecho,
} from "./texto-legal";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: `O combinado entre você e o ${NOME_DO_PRODUTO}: teste grátis, planos, pagamento por Pix, cancelamento e uso do sistema.`,
  alternates: { canonical: "/termos" },
};

/*
  Preços, dias de teste e limites saem das mesmas constantes que o sistema usa
  para cobrar e liberar recursos. Assim o texto nunca promete um número que a
  tela de assinatura não cumpre. Mudou alguma regra escrita aqui à mão, muda a
  data também.
*/
const ATUALIZADOS_EM = "2026-10-15";

function LinhaDoPlano({ plano }: { plano: Plano }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="min-w-0 text-carvao">{plano.nome}</dt>
      <dd className="shrink-0 font-semibold whitespace-nowrap text-carvao tabular-nums">
        {emReais(plano.valorCentavos)}{" "}
        <span className="font-normal text-carvao-suave">{plano.periodo}</span>
      </dd>
    </div>
  );
}

export default function PaginaTermos() {
  return (
    <PaginaLegal
      titulo="Termos de uso"
      atualizadaEm={ATUALIZADOS_EM}
      outra={{ href: "/privacidade", rotulo: "Política de privacidade" }}
      resumo={
        <p>
          Estes termos são o combinado entre você e o {NOME_DO_PRODUTO}. Ao criar a conta,
          você concorda com eles e com a{" "}
          <Link href="/privacidade" className="font-semibold text-terracota hover:underline">
            Política de privacidade
          </Link>
          . Escrevemos do jeito mais direto que conseguimos; se algo ficar confuso,
          pergunte.
        </p>
      }
    >
      <Trecho id="o-servico" titulo="O serviço">
        <p>
          O {NOME_DO_PRODUTO} é um sistema on-line para estúdios que atendem com hora
          marcada, oferecido por <QuemResponde />. Ele reúne agenda, ficha de clientes,
          serviços, cobranças pelo WhatsApp com Pix e faturamento do mês. O plano VIP
          acrescenta lembretes de cobrança, contas a pagar e prazos de contrato, leitura
          de documentos e a aba Finanças. Funciona no navegador, sem instalar nada.
        </p>
      </Trecho>

      <Trecho id="sua-conta" titulo="Sua conta">
        <Itens>
          <Item>
            Para criar a conta, você precisa ter 18 anos ou mais e informar dados
            verdadeiros, inclusive o CPF ou CNPJ, que identifica a assinatura.
          </Item>
          <Item>
            Cada conta é de um estúdio. A senha é sua: guarde-a bem, porque o que for
            feito com ela fica por sua conta. Se desconfiar que alguém entrou, troque a
            senha e fale com a gente.
          </Item>
          <Item>
            Mantenha o WhatsApp do cadastro em dia: é por ele que mandamos o link quando
            você esquece a senha.
          </Item>
        </Itens>
      </Trecho>

      <Trecho id="teste" titulo="Teste grátis">
        <p>
          Toda conta nova começa com {DIAS_DE_TESTE} dias de teste, sem cartão e sem
          compromisso.{" "}
          {testeLiberaOVip()
            ? "No teste, todos os recursos ficam abertos, inclusive os do VIP."
            : "No teste você usa os recursos do plano Essencial; os do VIP abrem quando você assina o VIP."}{" "}
          Quando o teste termina, o painel pede a assinatura para continuar. Nada é
          cobrado sozinho.
        </p>
      </Trecho>

      <Trecho id="planos" titulo="Planos e preços">
        <dl className="divide-y divide-areia-escura/60 rounded-2xl border border-areia-escura/70 bg-superficie px-4">
          <LinhaDoPlano plano={PLANOS.mensal} />
          <LinhaDoPlano plano={PLANOS.anual} />
          <LinhaDoPlano plano={PLANOS.vip_mensal} />
          <LinhaDoPlano plano={PLANOS.vip_anual} />
        </dl>
        <p>
          O mensal dá {PLANOS.mensal.dias} dias de acesso a cada pagamento, e o anual,{" "}
          {PLANOS.anual.dias} dias. O VIP inclui tudo o que o Essencial tem.
        </p>
        <p>
          Os preços valem na data em que você paga. Se mudarem, a mudança só vale a partir
          do próximo período que você pagar, e avisamos antes.
        </p>
      </Trecho>

      <Trecho id="pagamento" titulo="Pagamento por Pix">
        <p>
          O pagamento é feito por Pix, com o código que aparece na tela de assinatura do
          painel. Depois de pagar, você toca em <NaTela>Já fiz o Pix</NaTela> e nós
          conferimos o recebimento à mão. O acesso é liberado assim que confirmamos;
          enquanto isso, o painel mostra um recado de espera.
        </p>
        <p>
          Se você pagar antes de o período atual acabar, os dias que ainda faltavam não se
          perdem: eles se somam ao novo período.
        </p>
      </Trecho>

      <Trecho id="vencimento" titulo="Renovação e vencimento">
        <p>
          Não existe cobrança automática: cada período é renovado por um novo Pix, quando
          você decidir. Se a assinatura vencer, o acesso fica limitado à tela de
          assinatura até o próximo pagamento.
        </p>
        <p>
          Nenhum dado é apagado porque a assinatura venceu. Tudo volta como estava assim
          que o pagamento é confirmado. Se um dia decidirmos apagar contas vencidas há
          muito tempo, avisaremos antes pelo contato do cadastro, com prazo para você
          baixar os seus dados.
        </p>
      </Trecho>

      <Trecho id="cancelamento" titulo="Cancelamento e reembolso">
        <p>
          Você pode cancelar quando quiser, sem multa e sem fidelidade: basta não renovar.
          Se quiser apagar tudo, use <NaTela>Excluir minha conta</NaTela>, em Minha conta,
          depois de baixar uma cópia dos seus dados se quiser guardá-los.
        </p>
        <p>
          O período que já foi pago não é devolvido, a não ser quando a lei garantir. O
          Código de Defesa do Consumidor (art. 49) dá 7 dias para desistir de uma
          contratação feita pela internet: se você desistir nesse prazo, devolvemos o
          valor pago, por Pix. É só pedir por um dos contatos abaixo.
        </p>
        <p>
          Podemos suspender ou encerrar uma conta que descumpra estes termos. Quando for
          possível, avisamos antes e damos prazo para você baixar os seus dados; só não
          avisamos quando a lei ou a segurança de outras pessoas pedir ação imediata.
        </p>
      </Trecho>

      <Trecho id="uso" titulo="O que combinamos sobre o uso">
        <p>Ao usar o {NOME_DO_PRODUTO}, você se compromete a:</p>
        <Itens>
          <Item>usar o sistema no seu próprio negócio e para fins legais;</Item>
          <Item>
            cadastrar dados de clientes só com uma razão legítima para isso, e deixar os
            seus clientes saberem que você usa um sistema para organizar o atendimento;
          </Item>
          <Item>
            não usar as mensagens prontas para spam, envio em massa ou cobrança do que não
            é devido;
          </Item>
          <Item>
            não tentar entrar na conta de outro estúdio, não testar falhas de segurança
            sem combinar com a gente, não sobrecarregar o sistema e não copiar o{" "}
            {NOME_DO_PRODUTO};
          </Item>
          <Item>não enviar arquivos com vírus ou conteúdo ilegal;</Item>
          <Item>não revender nem emprestar a sua conta.</Item>
        </Itens>
      </Trecho>

      <Trecho id="seus-dados" titulo="Os dados do seu estúdio">
        <p>
          O que você cadastra é seu. Pelos dados dos seus clientes, o seu estúdio é o
          controlador, e o {NOME_DO_PRODUTO} trata esses dados só para prestar o serviço,
          como operador. A{" "}
          <Link href="/privacidade" className="font-semibold text-terracota hover:underline">
            Política de privacidade
          </Link>{" "}
          explica isso em detalhe. Você pode baixar uma cópia de tudo quando quiser.
        </p>
      </Trecho>

      <Trecho id="leitura" titulo="Leitura de documentos e números estimados">
        <p>
          No plano VIP, você pode enviar contratos, boletos e contas para o{" "}
          {NOME_DO_PRODUTO} ler, até {LEITURAS_POR_MES_NO_VIP} leituras por mês. A leitura
          é feita por inteligência artificial e serve para ajudar: ela pode errar ou deixar
          algo de fora. Por isso nada entra no seu financeiro sem você conferir e aceitar,
          item por item. Antes de pagar ou decidir qualquer coisa, confira com o documento
          original.
        </p>
        <p>
          O imposto que aparece na aba Finanças é uma estimativa, feita com o percentual
          que você escolhe, e não uma guia. O {NOME_DO_PRODUTO} organiza as suas
          informações, mas não substitui contador, advogado ou o seu banco.
        </p>
      </Trecho>

      <Trecho id="disponibilidade" titulo="Disponibilidade">
        <p>
          Trabalhamos para o {NOME_DO_PRODUTO} ficar no ar o tempo todo, mas pode haver
          pausas para manutenção e falhas que não dependem da gente, como as da internet
          ou de fornecedores. Quando uma pausa longa for planejada, avisamos antes.
        </p>
      </Trecho>

      <Trecho id="responsabilidade" titulo="Até onde vai a nossa responsabilidade">
        <p>Dentro do que a lei permite, o {NOME_DO_PRODUTO} não responde por:</p>
        <Itens>
          <Item>
            decisões tomadas com base em leituras automáticas ou estimativas sem
            conferência;
          </Item>
          <Item>informações erradas que tenham sido cadastradas na conta;</Item>
          <Item>
            falhas da internet, do seu aparelho ou de serviços de terceiros, como o
            WhatsApp e os bancos;
          </Item>
          <Item>lucros que deixaram de entrar e outros danos indiretos.</Item>
        </Itens>
        <p>
          Quando houver responsabilidade nossa, ela fica limitada ao valor que você pagou
          ao {NOME_DO_PRODUTO} nos 12 meses anteriores. Nada nestes termos tira direitos
          que o Código de Defesa do Consumidor garante a você.
        </p>
      </Trecho>

      <Trecho id="propriedade" titulo="A marca e o sistema">
        <p>
          O {NOME_DO_PRODUTO}, a marca e o programa pertencem a quem oferece o serviço.
          Enquanto a sua conta existir, você tem o direito de usar o sistema; os dados que
          você cadastra continuam sendo seus.
        </p>
      </Trecho>

      <Trecho id="mudancas" titulo="Mudanças nestes termos">
        <p>
          Podemos atualizar estes termos. Quando a mudança for importante, avisamos pelo
          e-mail ou pelo WhatsApp do cadastro pelo menos 15 dias antes de ela valer. Se não
          concordar, você pode cancelar e baixar os seus dados antes disso.
        </p>
      </Trecho>

      <Trecho id="lei" titulo="Lei e foro">
        <p>
          Estes termos seguem as leis do Brasil. Se houver uma disputa, ela pode ser
          levada ao foro da cidade onde você mora. Antes disso, fale com a gente: quase
          tudo se resolve numa conversa.
        </p>
      </Trecho>

      <Trecho id="contato" titulo="Contato">
        <Contatos />
      </Trecho>
    </PaginaLegal>
  );
}
