// 画像を並べた一覧画像を作る： node tests/montage.cjs 出力.png 列数 幅 画像...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const [out, cols, w, ...files] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: cols * w, height: 100 } });
  const html = `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:#888">` +
    files.map(f => `<div style="position:relative"><img src="file://${path.resolve(f)}" style="width:${w}px;display:block"><span style="position:absolute;left:2px;top:2px;background:#000a;color:#fff;font:11px sans-serif;padding:1px 3px">${path.basename(f)}</span></div>`).join('') + '</body>';
  const tmp = path.resolve(path.dirname(out), '_montage.html');
  fs.writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
