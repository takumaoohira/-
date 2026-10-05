// 声のサンプルを書き出す： node tests/voice-check.cjs 出力フォルダ
//   voice_samples.wav（聴いて確認する用）と voice_spectrogram.png（周波数の分布）
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../docs');
const LINES = ['voice:boss:ハイ！', 'voice:boss:クラップ！', 'voice:boss:ターン！', 'voice:boss:フリーズ！', 'voice:kid:ペッタン！', 'voice:gorilla:ウホッ！',
  'voice:duck:ナイス！', 'voice:clown:ソーレ！', 'voice:clown:ホイッ', 'voice:lady:ダブル！', 'voice:lady:スイッチ！', 'voice:penguin:マイド！', 'voice:crowd:イェーイ！',
  'voice:uncle:ザン:A3:0.35', 'voice:uncle:ギョウ:C4:0.35', 'voice:uncle:ダー:E4:0.7', 'voice:robo:キメ', 'voice:boss:オイオイ？'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  const r = await p.evaluate(LINES => {
    const sr = 22050, parts = [], stats = [];
    LINES.forEach(id => { const a = RG.Synth.render(id, sr); let nan = 0, m = 0; a.forEach(v => { if (!isFinite(v)) nan++; m = Math.max(m, Math.abs(v)); }); stats.push([id, (a.length / sr).toFixed(2) + 's', 'onset ' + RG.Voice.onset(id).toFixed(3), nan ? 'NaN!' : 'ok']); parts.push(a, new Float32Array(sr * 0.35)); });
    const n = parts.reduce((s, x) => s + x.length, 0), all = new Float32Array(n); let o = 0; parts.forEach(x => { all.set(x, o); o += x.length; });
    // スペクトログラム
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 400; const g = cv.getContext('2d');
    const N = 512, hop = Math.floor(n / 1200);
    for (let x = 0; x < 1200; x++) {
      const s0 = x * hop;
      for (let k = 1; k < 200; k++) { // 0〜8.6kHz
        let re = 0, im = 0; const w = 2 * Math.PI * k / N;
        for (let j = 0; j < N; j++) { const v = (all[s0 + j] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / N)); re += v * Math.cos(w * j); im -= v * Math.sin(w * j); }
        const db = 20 * Math.log10(Math.sqrt(re * re + im * im) + 1e-6);
        const c = Math.max(0, Math.min(255, (db + 30) * 5));
        g.fillStyle = `rgb(${c},${c * 0.7},${255 - c})`; g.fillRect(x, 400 - k * 2, 1, 2);
      }
    }
    // WAV
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf); const W = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    W(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); W(8, 'WAVE'); W(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); W(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, all[i])) * 32000, true);
    let bin = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return { stats, png: cv.toDataURL(), wav: btoa(bin) };
  }, LINES);
  r.stats.forEach(s => console.log(s.join('  ')));
  fs.writeFileSync(path.join(OUT, 'voice_samples.wav'), Buffer.from(r.wav, 'base64'));
  fs.writeFileSync(path.join(OUT, 'voice_spectrogram.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  await b.close();
})();
