import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * O espaço privado onde os documentos ficam.
 *
 * O arquivo nunca passa pela função do site: o navegador envia direto para o
 * Supabase, por um endereço assinado que vale poucos minutos. Isso existe por
 * duas razões. A primeira é tamanho: a hospedagem limita o corpo da requisição,
 * e um contrato de trinta páginas estoura. A segunda é tempo: função de site
 * tem segundos para responder, e subir arquivo não cabe nisso.
 *
 * O endereço assinado só é gerado depois de conferir, no servidor, que o
 * documento é do estúdio da sessão.
 */

export const ESPACO = "documentos";

/** Teto do arquivo. Acima disso a leitura também não daria conta. */
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;
export const PAGINAS_MAXIMAS = 30;

export const TIPOS_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function tipoAceito(tipo: string) {
  return (TIPOS_ACEITOS as readonly string[]).includes(tipo);
}

let cliente: SupabaseClient | null = null;

/**
 * O cliente com a chave de serviço, que ignora o RLS do espaço de arquivos.
 * Por isso ele vive só no servidor e nunca é exportado para a tela.
 */
function arquivos(): SupabaseClient | null {
  if (cliente) return cliente;

  const endereco = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endereco || !chave) return null;

  cliente = createClient(endereco, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export function envioConfigurado() {
  return arquivos() !== null;
}

/** O caminho sempre começa pelo estúdio, então um arquivo nunca cai na pasta de outro. */
export function caminhoDoDocumento(usuarioId: string, documentoId: string, nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(-80);
  return `${usuarioId}/${documentoId}/${limpo}`;
}

export async function enderecoParaEnviar(caminho: string) {
  const db = arquivos();
  if (!db) return null;

  const { data, error } = await db.storage.from(ESPACO).createSignedUploadUrl(caminho);
  if (error || !data) return null;
  return { endereco: data.signedUrl, chave: data.token };
}

export async function baixar(caminho: string): Promise<{ base64: string; tipo: string } | null> {
  const db = arquivos();
  if (!db) return null;

  const { data, error } = await db.storage.from(ESPACO).download(caminho);
  if (error || !data) return null;

  const bytes = Buffer.from(await data.arrayBuffer());
  return { base64: bytes.toString("base64"), tipo: data.type || "application/pdf" };
}

export async function apagar(caminhos: string[]) {
  const db = arquivos();
  if (!db || caminhos.length === 0) return;
  await db.storage.from(ESPACO).remove(caminhos);
}

/** Endereço de leitura curto, para a pessoa abrir o próprio documento. */
export async function enderecoParaVer(caminho: string, segundos = 300) {
  const db = arquivos();
  if (!db) return null;
  const { data, error } = await db.storage
    .from(ESPACO)
    .createSignedUrl(caminho, segundos);
  if (error || !data) return null;
  return data.signedUrl;
}
