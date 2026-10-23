const { chromium } = require("playwright");
const path = require("path");
const D = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const itens = [["1-dia", 1080, 1350], ["2-cobranca", 1080, 1350], ["3-link", 1080, 1350], ["4-stories", 1080, 1920]];
  for (const [nome, w, h] of itens) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto("file://" + path.join(D, nome + ".html"));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(D, `bossa-anuncio-${nome}.png`) });
    await p.close();
  }
  await b.close();
})();
