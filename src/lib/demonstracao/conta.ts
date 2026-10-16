/**
 * A conta do estúdio de exemplo, o que a demonstração mostra.
 *
 * É UMA conta no banco, compartilhada por todo mundo que ainda não assinou. Por
 * isso ninguém entra nela: o e-mail termina em ".invalid" (domínio que a
 * internet reserva para nunca existir), a senha não é hash de senha nenhuma e
 * o login recusa esse papel antes de olhar a senha. As telas só a leem; as
 * ações sempre gravam na conta da sessão, nunca nesta (ver lib/guardas.ts).
 *
 * Arquivo sem banco e sem servidor: as telas, as ações e os testes importam
 * daqui as mesmas constantes.
 */

/** Fixo, para os links da demonstração continuarem valendo depois de refazer os dados. */
export const ID_DO_ESTUDIO_DE_EXEMPLO = "estudio-de-exemplo";
export const EMAIL_DO_ESTUDIO_DE_EXEMPLO = "exemplo@demonstracao.bossa.invalid";
export const PAPEL_DA_DEMONSTRACAO = "demonstracao";

/** Para onde vai quem tenta fazer alguma coisa durante a demonstração. */
export const DESTINO_DA_DEMONSTRACAO = "/painel/assinatura?demonstracao=1";

/** Se o usuário é a conta de exemplo. Confere os dois sinais: um basta para recusar. */
export function ehContaDeExemplo(usuario: { id?: string | null; papel?: string | null } | null | undefined) {
  if (!usuario) return false;
  return usuario.id === ID_DO_ESTUDIO_DE_EXEMPLO || usuario.papel === PAPEL_DA_DEMONSTRACAO;
}

/** E-mail que ninguém pode usar para criar conta nem para pedir senha nova. */
export function emailReservado(email: string) {
  const limpo = email.trim().toLowerCase();
  return limpo === EMAIL_DO_ESTUDIO_DE_EXEMPLO || limpo.endsWith("@demonstracao.bossa.invalid");
}
