/**
 * Script que roda antes da página aparecer, para o tema salvo já valer no
 * primeiro desenho. Sem isso o site pisca branco antes de ficar escuro.
 *
 * Fica fora de tema.tsx de propósito. Aquele arquivo é "use client", e tudo o
 * que um componente do servidor importa de um arquivo assim chega ao navegador
 * como uma referência para baixar, não como o texto. No layout raiz, isso
 * fazia o <head> esperar o arquivo de JavaScript do botão de tema: quando ele
 * chegava depois de a hidratação começar (o que acontecia ao abrir a página de
 * vendas vindo de /entrar), o React não reconhecia o HTML do servidor, dava o
 * erro #418 e redesenhava a página inteira. Aqui é texto puro, que vai junto
 * com o HTML.
 */
export const scriptDoTema = `
(function () {
  try {
    var salvo = localStorage.getItem("tema");
    if (salvo === "claro" || salvo === "escuro") {
      document.documentElement.dataset.tema = salvo;
    }
  } catch (e) {}
})();
`;
