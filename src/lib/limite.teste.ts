import { describe, expect, it } from "vitest";
import {
  MINUTOS_DE_ESPERA,
  RECADO_DE_ESPERA,
  TENTATIVAS_ANTES_DE_ESPERAR,
  chaveDoEmail,
  chaveDoPainel,
  conferirComFreio,
  fimDaGuarda,
  inicioDaJanela,
  precisaEsperar,
  type BancoDoFreio,
} from "@/lib/limite";

/**
 * Um banco de mentira, só com o que o freio usa. As consultas de verdade são
 * conferidas em src/testes/conta-banco.teste.ts, contra o Postgres.
 */
function bancoDeMentira() {
  let linhas: { chave: string; criadoEm: Date }[] = [];

  type Onde = { chave?: string; criadoEm?: { gte?: Date; lt?: Date } };
  const casa = (linha: { chave: string; criadoEm: Date }, onde: Onde = {}) =>
    (onde.chave === undefined || linha.chave === onde.chave) &&
    (onde.criadoEm?.gte === undefined || linha.criadoEm >= onde.criadoEm.gte) &&
    (onde.criadoEm?.lt === undefined || linha.criadoEm < onde.criadoEm.lt);

  const db = {
    tentativaDeEntrada: {
      count: async ({ where }: { where: Onde }) =>
        linhas.filter((l) => casa(l, where)).length,
      create: async ({ data }: { data: { chave: string; criadoEm: Date } }) => {
        linhas.push(data);
        return data;
      },
      deleteMany: async ({ where }: { where: Onde }) => {
        const antes = linhas.length;
        linhas = linhas.filter((l) => !casa(l, where));
        return { count: antes - linhas.length };
      },
    },
  } as unknown as BancoDoFreio;

  return { db, linhas: () => linhas };
}

const agora = new Date("2026-10-14T15:00:00.000Z");
const minutos = (n: number) => new Date(agora.getTime() + n * 60 * 1000);

describe("chave do e-mail", () => {
  it("é o mesmo resumo com maiúsculas e espaços nas pontas", () => {
    expect(chaveDoEmail(" Ana@Estudio.com.br ")).toBe(chaveDoEmail("ana@estudio.com.br"));
  });

  it("não guarda o e-mail em texto", () => {
    const chave = chaveDoEmail("ana@estudio.com.br");
    expect(chave).toHaveLength(64);
    expect(chave).not.toContain("ana");
  });

  it("e-mails diferentes dão chaves diferentes", () => {
    expect(chaveDoEmail("ana@x.com")).not.toBe(chaveDoEmail("bia@x.com"));
  });

  it("a chave do painel é outra, para a entrada e o painel não se travarem", () => {
    expect(chaveDoPainel("conta1")).toHaveLength(64);
    expect(chaveDoPainel("conta1")).not.toBe(chaveDoPainel("conta2"));
    expect(chaveDoPainel("conta1")).not.toBe(chaveDoEmail("conta1"));
  });
});

describe("regra do freio", () => {
  it("deixa tentar até a oitava e para a partir dela", () => {
    expect(TENTATIVAS_ANTES_DE_ESPERAR).toBe(8);
    expect(precisaEsperar(0)).toBe(false);
    expect(precisaEsperar(7)).toBe(false);
    expect(precisaEsperar(8)).toBe(true);
    expect(precisaEsperar(20)).toBe(true);
  });

  it("a janela olha quinze minutos para trás", () => {
    expect(MINUTOS_DE_ESPERA).toBe(15);
    expect(inicioDaJanela(agora).toISOString()).toBe("2026-10-14T14:45:00.000Z");
  });

  it("a faxina leva o que tem mais de um dia", () => {
    expect(fimDaGuarda(agora).toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });

  it("o recado manda esperar e lembra do Esqueci minha senha", () => {
    expect(RECADO_DE_ESPERA).toContain("15 minutos");
    expect(RECADO_DE_ESPERA).toContain("Esqueci minha senha");
  });
});

describe("conferir com freio", () => {
  const certa = async () => true;
  const errada = async () => false;

  it("a nona tentativa espera, mesmo com a senha certa", async () => {
    const { db } = bancoDeMentira();
    for (let vez = 0; vez < 8; vez++) {
      expect(
        await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, minutos(vez)),
      ).toBe("errada");
    }
    expect(await conferirComFreio(db, chaveDoEmail("ana@x.com"), certa, minutos(8))).toBe(
      "espere",
    );
  });

  it("na espera, a senha nem é conferida e o erro não conta de novo", async () => {
    const { db, linhas } = bancoDeMentira();
    for (let vez = 0; vez < 8; vez++)
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, agora);

    let conferiu = false;
    const espiar = async () => {
      conferiu = true;
      return true;
    };
    expect(
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), espiar, minutos(1)),
    ).toBe("espere");
    expect(conferiu).toBe(false);
    expect(linhas()).toHaveLength(8);
  });

  it("passados quinze minutos do primeiro erro, volta a deixar tentar", async () => {
    const { db } = bancoDeMentira();
    for (let vez = 0; vez < 8; vez++)
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, agora);

    expect(
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), certa, minutos(14)),
    ).toBe("espere");
    expect(
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), certa, minutos(16)),
    ).toBe("confere");
  });

  it("acertar zera a contagem daquele e-mail, e só dele", async () => {
    const { db, linhas } = bancoDeMentira();
    for (let vez = 0; vez < 5; vez++)
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, agora);
    for (let vez = 0; vez < 3; vez++)
      await conferirComFreio(db, chaveDoEmail("bia@x.com"), errada, agora);

    expect(await conferirComFreio(db, chaveDoEmail("ana@x.com"), certa, agora)).toBe(
      "confere",
    );
    expect(linhas()).toHaveLength(3);
    expect(linhas().every((linha) => linha.chave === chaveDoEmail("bia@x.com"))).toBe(
      true,
    );
  });

  it("um e-mail travado não trava o outro", async () => {
    const { db } = bancoDeMentira();
    for (let vez = 0; vez < 8; vez++)
      await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, agora);
    expect(await conferirComFreio(db, chaveDoEmail("bia@x.com"), certa, agora)).toBe(
      "confere",
    );
  });

  it("errar leva junto as tentativas com mais de um dia", async () => {
    const { db, linhas } = bancoDeMentira();
    await conferirComFreio(
      db,
      chaveDoEmail("velha@x.com"),
      errada,
      minutos(-2 * 24 * 60),
    );
    await conferirComFreio(db, chaveDoEmail("ana@x.com"), errada, agora);

    expect(linhas()).toHaveLength(1);
    expect(linhas()[0].chave).toBe(chaveDoEmail("ana@x.com"));
  });
});
