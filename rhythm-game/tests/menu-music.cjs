// メニューBGMの確認： node tests/menu-music.cjs
//   画面ごとに流れる／止まる、重ならない、16小節ループの音割れ
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  const st = () => p.evaluate(() => ({ screen: RG.App.screen, playing: RG.MenuMusic.playing }));
  const log = [];
  log.push(['タイトル（音声の許可前）', await st()]);
  await p.click('#btn-start'); await p.waitForTimeout(1500);
  log.push(['選択画面', await st()]);
  await p.evaluate(() => RG.App.show('settings')); await p.waitForTimeout(300);
  log.push(['設定', await st()]);
  await p.evaluate(() => RG.App.show('select')); await p.evaluate(() => RG.App.show('settings')); await p.evaluate(() => RG.App.show('select'));
  await p.waitForTimeout(1500);
  const srcs = await p.evaluate(() => RG.Audio.ctx.currentTime);
  log.push(['画面を行き来しても1つだけ（再生中フラグ）', await st()]);
  await p.evaluate(() => RG.App.startGame('robot', 'main')); await p.waitForTimeout(800);
  log.push(['プレイ中', await st()]);
  await p.evaluate(() => { RG.App.stopSession(); RG.App.show('select'); }); await p.waitForTimeout(500);
  log.push(['選択画面に戻る', await st()]);
  // オフラインで16小節を書き出してピークを測る
  const mix = await p.evaluate(async () => {
    const sr = 44100, spb = 60 / RG.MenuMusic.BPM, len = Math.ceil(16 * 4 * spb * sr) + sr;
    const ctx = new OfflineAudioContext(2, len, sr); const cache = new Map();
    const S = RG.Storage.defaults().settings.vol, curve = v => Math.pow(v / 100, 1.6);
    const bus = { bgm: curve(S.bgm) * 0.8 * 2.2, voice: curve(S.voice) };
    // menu-music.js の barEvents を使うため、一時的に同じ編曲を呼ぶ
    const evs = [];
    for (let k = 0; k < 16; k++) RG.MenuMusic._bar(k).forEach(e => evs.push(Object.assign({}, e, { t: k * 4 * spb + e.b * spb })));
    for (const e of evs) {
      let buf = cache.get(e.id); if (!buf) { const d = RG.Synth.render(e.id, sr); buf = ctx.createBuffer(1, d.length, sr); buf.getChannelData(0).set(d); cache.set(e.id, buf); }
      const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = (e.gain || 1) * (bus[e.bus || 'bgm'] || bus.bgm) * curve(S.master);
      const pn = ctx.createStereoPanner(); pn.pan.value = e.pan || 0; s.connect(g); g.connect(pn); pn.connect(ctx.destination); s.start(Math.max(0, e.t));
    }
    const r = await ctx.startRendering(); let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < 2; c++) r.getChannelData(c).forEach(v => { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; });
    return { seconds: (len / sr).toFixed(1), events: evs.length, peak: peak.toFixed(3), rmsDb: (10 * Math.log10(sum / n)).toFixed(1) };
  });
  log.forEach(([k, v]) => console.log(k.padEnd(24), JSON.stringify(v)));
  console.log('16小節ループ', JSON.stringify(mix));
  console.log('errors', errs);
  await b.close();
})();
