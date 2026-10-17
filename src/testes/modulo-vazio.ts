/**
 * Fica no lugar de `server-only` nos testes. O pacote de verdade lança erro
 * fora do servidor do Next; nos testes, os arquivos de servidor rodam direto
 * no Node, e o que importa conferir é a lógica deles.
 */
export {};
