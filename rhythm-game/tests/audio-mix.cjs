/*
 * 音量バランスの確認（OfflineAudioContext で本編を書き出して測る）
 *   NODE_PATH=$(npm root -g) node tests/audio-mix.cjs
 * - 全体のピーク（1.0 を超えると音割れ）
 * - 合図の聞き取りやすさ：各合図の直後60msで「合図だけ」と「BGMだけ」の音量差（dB）
 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  const res = await p.evaluate(async () => {
    const out = {};
    for (const id of Object.keys(RG.Games)) {
      const game = RG.Games[id];
      const chart = new RG.Chart(game);
      game.main.forEach((t, i, a) => chart.place(t, a[i + 1]));
      const evs = chart.drainAudio();
      const sr = 44100, len = Math.ceil((chart.t(chart.endBeat) + 3) * sr);
      const S = RG.Storage.defaults().settings.vol;
      const curve = v => Math.pow(v / 100, 1.6);
      const busGain = { bgm: curve(S.bgm) * 0.8, cue: curve(S.cue) * 1.1, sfx: curve(S.sfx), voice: curve(S.voice) };
      const render = async (filter) => {
        const ctx = new OfflineAudioContext(1, len, sr);
        const cache = new Map();
        for (const e of evs) {
          if (!filter(e)) continue;
          let buf = cache.get(e.id);
          if (!buf) { const d = RG.Synth.render(e.id, sr); buf = ctx.createBuffer(1, d.length, sr); buf.getChannelData(0).set(d); cache.set(e.id, buf); }
          const s = ctx.createBufferSource(); s.buffer = buf;
          const g = ctx.createGain(); g.gain.value = (e.gain || 1) * busGain[e.bus] * curve(S.master);
          s.connect(g); g.connect(ctx.destination); s.start(Math.max(0, e.time + 0.1));
        }
        return (await ctx.startRendering()).getChannelData(0);
      };
      const all = await render(() => true);
      const bgm = await render(e => e.bus === 'bgm');
      const cue = await render(e => e.bus === 'cue');
      let peak = 0, peakAt = 0; all.forEach((v, i) => { if (Math.abs(v) > peak) { peak = Math.abs(v); peakAt = i / sr - 0.1; } });
      const rms = (a, t0, ms) => { const i0 = Math.floor((t0 + 0.1) * sr), n = Math.floor(ms / 1000 * sr); let s = 0; for (let i = i0; i < i0 + n && i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / n) + 1e-9; };
      const snr = {};
      chart.cues.forEach(c => {
        if (['count', 'fin', 'tickL', 'tickR', 'swish', 'sing'].includes(c.type)) return;
        const d = 20 * Math.log10(rms(cue, c.time, 60) / rms(bgm, c.time, 60));
        (snr[c.type] = snr[c.type] || []).push(d);
      });
      chart.cues.filter(c => c.type === 'sing').forEach(c => { const d = 20 * Math.log10(rms(cue, c.time, 200) / rms(bgm, c.time, 200)); (snr.sing = snr.sing || []).push(d); });
      const summary = {};
      for (const k in snr) { const a = snr[k].sort((x, y) => x - y); summary[k] = { min: a[0].toFixed(1), median: a[a.length >> 1].toFixed(1), n: a.length }; }
      const sp = {}; for (const e of evs) if (!sp[e.id]) { const d = RG.Synth.render(e.id, sr); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); sp[e.id] = +m.toFixed(2); }
      out[id + '_samplePeaks'] = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v > 0.6));
      out[id] = { seconds: (len / sr).toFixed(1), peak: peak.toFixed(3), peakBeat: chart.beatAt(peakAt).toFixed(2), cueOverBgmDb: summary, events: evs.length, uniqueSounds: new Set(evs.map(e => e.id)).size };
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 2));
  await b.close();
})();
