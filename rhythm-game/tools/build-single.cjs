// 1ファイル版を作る： node tools/build-single.cjs [出力先] [--artifact]
//   dist/rhythm-biyori.html … CSS・JSをすべて埋め込んだ単体ファイル（ダブルクリックで遊べる）
//   --artifact … 公開ページ用（<html><head><body> を付けない形式）
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist/rhythm-biyori.html');
const artifact = process.argv.includes('--artifact');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${css}\n</style>`);
const scripts = [];
html = html.replace(/<script src="([^"]+)"><\/script>\n?/g, (m, src) => { scripts.push(fs.readFileSync(path.join(root, src), 'utf8')); return ''; });
html = html.replace('</body>', () => `<script>\n${scripts.join('\n;\n')}\n</script>\n</body>`);
if (artifact) {
  const title = /<title>.*?<\/title>/.exec(html)[0];
  const style = /<style>[\s\S]*?<\/style>/.exec(html)[0];
  const body = /<body>([\s\S]*)<\/body>/.exec(html)[1];
  html = `${title}\n${style}\n${body}`;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + 'KB');
