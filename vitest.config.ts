import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

/**
 * Os testes de separação entre estúdios precisam de um Postgres de verdade,
 * porque é o banco que decide o que uma consulta devolve. O endereço vem de
 * .env.teste, que nunca aponta para produção. Sem o arquivo, esses testes são
 * pulados com um aviso, em vez de passarem sem testar nada.
 */
function lerEnvDeTeste(): Record<string, string> {
  if (!existsSync(".env.teste")) return {};
  const mapa: Record<string, string> = {};
  for (const linha of readFileSync(".env.teste", "utf8").split("\n")) {
    const encontrado = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(linha);
    if (encontrado) mapa[encontrado[1]] = encontrado[2];
  }
  return mapa;
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.teste.ts", "src/**/*.teste.tsx"],
    env: lerEnvDeTeste(),
    // Os testes de banco mexem nas mesmas tabelas; em paralelo eles se atropelam.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
