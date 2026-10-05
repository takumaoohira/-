// 簡易確認：ページを開いてエラーがないか、音声時計が進むか
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?dev');
  await page.click('#btn-start');
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[2] + '/select.png' });
  await page.click('#game-list .game-card button[data-mode=main]');
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => ({ t: RG.App.session.songTime(), ctx: RG.Audio.ctx.currentTime, state: RG.Audio.ctx.state, clock: RG.Audio.clockSource, ev: RG.App.session.events.length, src: RG.App.session.sb.sources.size }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: process.argv[2] + '/play.png' });
  console.log('errors', errors);
  await browser.close();
})();
