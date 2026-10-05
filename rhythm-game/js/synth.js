/*
 * 音素材はすべてこのファイルでプログラム合成しています（外部の音源ファイルは使っていません）。
 * 音色ID の形式：  "名前" / "名前:音名" / "名前:音名:長さ秒" / "pad:C4,E4,G4:長さ秒"
 * 本番用の録音素材に差し替える場合は、RG.Audio.buffer() で同じIDに AudioBuffer を登録すれば
 * 譜面・判定側は変更不要です（README「素材の差し替え」参照）。
 */
RG.Synth = (function () {
  const { freq } = RG.U;
  const TAU = Math.PI * 2;

  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const coef = (fc, sr) => 1 - Math.exp(-TAU * fc / sr);

  function buf(sr, sec) { return new Float32Array(Math.max(1, Math.ceil(sr * sec))); }
  function fadeEdges(a, sr, inMs = 1, outMs = 6) {
    const ni = Math.min(a.length, Math.floor(sr * inMs / 1000));
    const no = Math.min(a.length, Math.floor(sr * outMs / 1000));
    for (let i = 0; i < ni; i++) a[i] *= i / ni;
    for (let i = 0; i < no; i++) a[a.length - 1 - i] *= i / no;
    return a;
  }
  // 周波数が時間で変わるサイン（ピッチの下がる打楽器など）
  function sweep(a, sr, f0, f1, k, amp, decay, harm) {
    let ph = 0;
    for (let i = 0; i < a.length; i++) {
      const t = i / sr;
      const f = f1 + (f0 - f1) * Math.exp(-t * k);
      ph += TAU * f / sr;
      let s = Math.sin(ph);
      if (harm) s += harm * Math.sin(2 * ph);
      a[i] += amp * s * Math.exp(-t * decay);
    }
  }
  function tone(a, sr, f, amp, decay, start = 0) {
    const s0 = Math.floor(start * sr);
    for (let i = s0; i < a.length; i++) {
      const t = (i - s0) / sr;
      a[i] += amp * Math.sin(TAU * f * t) * Math.exp(-t * decay);
    }
  }
  // ノイズ（hp/lp の一次フィルタ付き）
  function noise(a, sr, amp, decay, lp, hp, attack = 0, start = 0) {
    let y1 = 0, y2 = 0;
    const a1 = lp ? coef(lp, sr) : 1, a2 = hp ? coef(hp, sr) : 0;
    const s0 = Math.floor(start * sr);
    for (let i = s0; i < a.length; i++) {
      const t = (i - s0) / sr;
      let x = rnd();
      y1 += a1 * (x - y1); x = y1;
      if (hp) { y2 += a2 * (x - y2); x = x - y2; }
      const env = (attack > 0 ? Math.min(1, t / attack) : 1) * Math.exp(-t * decay);
      a[i] += amp * x * env;
    }
  }

  // カープラス・ストロング法の撥弦音
  function ks(sr, f, dur, bright, decay, amp) {
    const a = buf(sr, dur);
    const N = Math.max(2, Math.round(sr / f));
    const line = new Float32Array(N);
    let y = 0;
    const c = coef(400 + bright * 8000, sr);
    for (let i = 0; i < N; i++) { y += c * (rnd() - y); line[i] = y; }
    let idx = 0;
    for (let i = 0; i < a.length; i++) {
      const nxt = (idx + 1) % N;
      const v = line[idx];
      line[idx] = decay * 0.5 * (v + line[nxt]);
      a[i] = v * amp;
      idx = nxt;
    }
    return fadeEdges(a, sr, 1, 30);
  }

  const INST = {
    // ---- リズム楽器（BGM） ----
    kick(sr) { const a = buf(sr, 0.35); sweep(a, sr, 130, 45, 28, 0.9, 9); noise(a, sr, 0.25, 280, 3000); return fadeEdges(a, sr); },
    snare(sr) { const a = buf(sr, 0.22); sweep(a, sr, 240, 180, 30, 0.35, 22); noise(a, sr, 0.55, 17, 7000, 900); return fadeEdges(a, sr); },
    hat(sr) { const a = buf(sr, 0.06); noise(a, sr, 0.35, 75, 0, 7000); return fadeEdges(a, sr); },
    shaker(sr) { const a = buf(sr, 0.1); noise(a, sr, 0.3, 40, 12000, 4500, 0.012); return fadeEdges(a, sr); },
    rim(sr) { const a = buf(sr, 0.08); tone(a, sr, 1700, 0.25, 60); noise(a, sr, 0.25, 90, 0, 2500); return fadeEdges(a, sr); },

    // ---- 音程楽器（BGM） ----
    koto(sr, n, d) { return ks(sr, freq(n), d || 1.2, 0.85, 0.996, 0.55); },
    pluck(sr, n, d) { return ks(sr, freq(n), d || 0.8, 0.45, 0.994, 0.5); },
    guitar(sr, n, d) { return ks(sr, freq(n), d || 1.6, 0.3, 0.997, 0.35); },
    bass(sr, n, d) {
      const f = freq(n), a = buf(sr, d || 0.6);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr;
        const s = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) + 0.12 * Math.sin(TAU * 3 * f * t);
        a[i] = 0.42 * s * Math.min(1, t / 0.006) * Math.exp(-t * 2.6);
      }
      return fadeEdges(a, sr, 1, 25);
    },
    marimba(sr, n, d) {
      const f = freq(n), a = buf(sr, d || 0.7);
      tone(a, sr, f, 0.45, 6.5); tone(a, sr, f * 3.93, 0.12, 22); tone(a, sr, f * 9.2, 0.04, 45);
      return fadeEdges(a, sr, 2, 20);
    },
    pizz(sr, n, d) { return ks(sr, freq(n), d || 0.4, 0.25, 0.985, 0.55); },
    flute(sr, n, d) {
      const f = freq(n), dur = d || 1, a = buf(sr, dur + 0.15);
      let ph = 0, y = 0; const c = coef(1800, sr);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr;
        const vib = 1 + 0.006 * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.35);
        ph += TAU * f * vib / sr;
        y += c * (rnd() - y);
        const env = Math.min(1, t / 0.06) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1) * (0.85 + 0.15 * Math.exp(-t * 3));
        a[i] = env * (0.26 * Math.sin(ph) + 0.06 * Math.sin(2 * ph) + 0.03 * y);
      }
      return fadeEdges(a, sr);
    },
    // 和音のパッド。音名はカンマ区切り
    pad(sr, ns, d) {
      const notes = ns.split(',').map(freq), dur = d || 2, rel = 0.45, a = buf(sr, dur + rel);
      for (const f of notes) {
        for (const det of [0.997, 1.003]) {
          let ph = Math.random() * TAU;
          for (let i = 0; i < a.length; i++) {
            const t = i / sr;
            ph += TAU * f * det / sr;
            const env = Math.min(1, t / 0.25) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
            a[i] += env * 0.055 * (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * (0.9 + 0.1 * Math.sin(TAU * 0.7 * t));
          }
        }
      }
      return fadeEdges(a, sr);
    },

    // ---- 合図（cue）：BGMに埋もれないよう、帯域と音色をはっきり分ける ----
    ton(sr) { const a = buf(sr, 0.2); tone(a, sr, 620, 0.42, 24); tone(a, sr, 1240, 0.2, 40); sweep(a, sr, 260, 180, 30, 0.22, 22); noise(a, sr, 0.15, 220, 6000, 800); return fadeEdges(a, sr); },
    ka(sr) { // カッ（金属的で高い。2連続の合図専用）
      const a = buf(sr, 0.22);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr;
        const sq = (f) => (Math.sin(TAU * f * t) > 0 ? 1 : -1);
        a[i] = 0.16 * (sq(587) + sq(845)) * Math.exp(-t * 20);
      }
      let y = 0; const c = coef(3500, sr); for (let i = 0; i < a.length; i++) { y += c * (a[i] - y); a[i] = y; }
      tone(a, sr, 2350, 0.2, 40);
      return fadeEdges(a, sr);
    },
    bell(sr) { // チリーン（通常便）
      const a = buf(sr, 0.9), f = 1318;
      [[1, 0.32, 4], [2.76, 0.14, 7], [5.4, 0.07, 12], [8.93, 0.04, 18]].forEach(([r, g, k]) => tone(a, sr, f * r, g, k));
      tone(a, sr, f, 0.2, 5, 0.07); tone(a, sr, f * 2.76, 0.07, 9, 0.07);
      return fadeEdges(a, sr, 1, 40);
    },
    whistle(sr) { // ピピッ（速達便）
      const a = buf(sr, 0.16);
      [0, 0.075].forEach(st => {
        let ph = 0; const s0 = Math.floor(st * sr), n = Math.floor(0.055 * sr);
        for (let i = 0; i < n && s0 + i < a.length; i++) {
          const t = i / sr, f = 2000 + 700 * (t / 0.055);
          ph += TAU * f / sr;
          a[s0 + i] += 0.32 * (Math.sin(ph) + 0.18 * Math.sin(3 * ph)) * Math.min(1, t / 0.004) * Math.min(1, (0.055 - t) / 0.01);
        }
      });
      return fadeEdges(a, sr);
    },
    pon(sr) { const a = buf(sr, 0.4); sweep(a, sr, 230, 150, 20, 0.7, 11); tone(a, sr, 340, 0.2, 22); noise(a, sr, 0.18, 70, 4000, 500); return fadeEdges(a, sr); },
    tickLo(sr) { const a = buf(sr, 0.07); tone(a, sr, 760, 0.28, 65); tone(a, sr, 1520, 0.08, 90); return fadeEdges(a, sr); },
    tickHi(sr) { const a = buf(sr, 0.06); noise(a, sr, 0.32, 85, 0, 8000); tone(a, sr, 3100, 0.07, 90); return fadeEdges(a, sr); },
    stick(sr) { const a = buf(sr, 0.07); tone(a, sr, 1900, 0.35, 70); noise(a, sr, 0.2, 140, 0, 3000); return fadeEdges(a, sr); },
    stickHi(sr) { const a = buf(sr, 0.08); tone(a, sr, 2500, 0.4, 60); noise(a, sr, 0.2, 140, 0, 3000); return fadeEdges(a, sr); },

    // ---- 成功・失敗の効果音 ----
    slap(sr) { const a = buf(sr, 0.3); sweep(a, sr, 150, 72, 18, 0.75, 13); noise(a, sr, 0.5, 34, 1600, 120); return fadeEdges(a, sr); },
    catchBox(sr) { const a = buf(sr, 0.22); sweep(a, sr, 240, 130, 25, 0.45, 18); noise(a, sr, 0.35, 30, 1200, 150); return fadeEdges(a, sr); },
    tan(sr) { const a = buf(sr, 0.35); sweep(a, sr, 330, 250, 22, 0.55, 14); noise(a, sr, 0.22, 16, 14000, 6000); return fadeEdges(a, sr); },
    sparkle(sr) { const a = buf(sr, 0.4); [2093, 2637, 3136].forEach((f, i) => tone(a, sr, f, 0.11, 12, i * 0.035)); return fadeEdges(a, sr); },
    chime(sr) { const a = buf(sr, 1.0); [784, 988, 1175, 1568].forEach((f, i) => tone(a, sr, f, 0.12, 4, i * 0.06)); return fadeEdges(a, sr, 1, 40); },
    // 失敗音は短く・控えめに（次の合図を邪魔しない）
    miss(sr) {
      const a = buf(sr, 0.16); let ph = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr, f = 330 - 160 * (t / 0.16);
        ph += TAU * f / sr;
        a[i] = 0.22 * (Math.sin(ph) + 0.3 * Math.sin(3 * ph)) * Math.min(1, t / 0.005) * (1 - t / 0.16);
      }
      return fadeEdges(a, sr);
    },
    kazoo(sr) { // ぷぅ（気の抜けた音）
      const a = buf(sr, 0.22); let ph = 0, y = 0; const c = coef(1400, sr);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr, f = 190 * (1 - 0.12 * t / 0.22) * (1 + 0.02 * Math.sin(TAU * 22 * t));
        ph += TAU * f / sr;
        let s = 0; for (let k = 1; k <= 6; k++) s += Math.sin(k * ph) / k;
        y += c * (s - y);
        a[i] = 0.17 * y * Math.min(1, t / 0.01) * (1 - t / 0.22);
      }
      return fadeEdges(a, sr);
    },
    drop(sr) { const a = buf(sr, 0.3); noise(a, sr, 0.5, 14, 600, 0, 0.02); sweep(a, sr, 110, 70, 10, 0.25, 12); return fadeEdges(a, sr); },
    tap(sr) { const a = buf(sr, 0.05); tone(a, sr, 420, 0.16, 90); noise(a, sr, 0.06, 150, 3000); return fadeEdges(a, sr); },
    // ドーン（締め）
    boom(sr) { const a = buf(sr, 1.2); sweep(a, sr, 110, 50, 6, 0.6, 3.2); noise(a, sr, 0.25, 6, 900, 0, 0.003); return fadeEdges(a, sr, 1, 60); },

    // ---- ファンク用の楽器（スポーツ系ミニゲーム） ----
    clap(sr) { const a = buf(sr, 0.25); [0, 0.011, 0.023].forEach(st => noise(a, sr, 0.32, 60, 5000, 900, 0, st)); noise(a, sr, 0.28, 14, 4500, 1000, 0, 0.03); return fadeEdges(a, sr); },
    ohat(sr) { const a = buf(sr, 0.32); noise(a, sr, 0.3, 9, 0, 6500); return fadeEdges(a, sr, 1, 40); },
    sbass(sr, n, d) { // スラップベース（はじく音＋低音）
      const f = freq(n), a = buf(sr, d || 0.4); let ph = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr; ph += TAU * f / sr;
        const bright = Math.exp(-t * 18);
        a[i] = 0.45 * (Math.sin(ph) + 0.5 * bright * Math.sin(2 * ph) + 0.3 * bright * Math.sin(3 * ph) + 0.15 * bright * Math.sin(5 * ph)) * Math.min(1, t / 0.003) * Math.exp(-t * 4);
      }
      noise(a, sr, 0.18, 120, 6000, 1500);
      return fadeEdges(a, sr, 1, 20);
    },
    clav(sr, n, d) { // クラビネット風（短く歯切れのよい鍵盤）
      const f = freq(n), a = buf(sr, d || 0.25); let ph = 0, y = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr; ph += TAU * f / sr;
        const sq = (ph % TAU) < TAU * 0.3 ? 1 : -1;
        const c = coef(600 + 5000 * Math.exp(-t * 25), sr);
        y += c * (sq - y);
        a[i] = 0.22 * y * Math.min(1, t / 0.002) * Math.exp(-t * 9);
      }
      return fadeEdges(a, sr, 1, 15);
    },
    brass(sr, ns, d) { // ブラスの短い和音
      const notes = ns.split(',').map(freq), dur = d || 0.3, a = buf(sr, dur + 0.15);
      notes.forEach(f => {
        let ph = 0, y = 0;
        for (let i = 0; i < a.length; i++) {
          const t = i / sr; ph += TAU * f * (1 + 0.004 * Math.sin(TAU * 6 * t)) / sr;
          const saw = (ph / Math.PI) % 2 - 1;
          const env = Math.min(1, t / 0.02) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1);
          const c = coef(900 + 2500 * Math.min(1, t / 0.05), sr);
          y += c * (saw - y);
          a[i] += 0.1 * y * env;
        }
      });
      return fadeEdges(a, sr);
    },
    scratch(sr) { // DJスクラッチ「キュッ」（1回分）
      const a = buf(sr, 0.12); let y = 0, ph = 0;
      const n = Math.floor(0.1 * sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, f = 300 + 1500 * Math.sin(Math.PI * t / 0.1);
        ph += TAU * f / sr;
        y += 0.3 * (rnd() - y);
        a[i] += 0.34 * (Math.sin(ph) * 0.7 + y * 0.6) * Math.sin(Math.PI * t / 0.1);
      }
      return fadeEdges(a, sr);
    },
    // 卓球
    pong(sr) { const a = buf(sr, 0.09); tone(a, sr, 1450, 0.45, 55); tone(a, sr, 2900, 0.15, 80); noise(a, sr, 0.25, 160, 9000, 1500); return fadeEdges(a, sr); },
    pok(sr) { const a = buf(sr, 0.06); tone(a, sr, 2300, 0.32, 90); noise(a, sr, 0.12, 200, 9000, 3000); return fadeEdges(a, sr); },
    smash(sr) { const a = buf(sr, 0.22); noise(a, sr, 0.75, 28, 9000, 1200); sweep(a, sr, 2600, 900, 25, 0.3, 30); tone(a, sr, 1450, 0.3, 50); return fadeEdges(a, sr); },
    lob(sr) {
      const a = buf(sr, 0.42); let ph = 0;
      for (let i = 0; i < a.length; i++) { const t = i / sr, f = 500 + 900 * (t / 0.42); ph += TAU * f / sr; a[i] = 0.2 * Math.sin(ph) * Math.min(1, t / 0.02) * (1 - t / 0.42); }
      tone(a, sr, 1100, 0.35, 45);
      return fadeEdges(a, sr);
    },
    pingHit(sr) { const a = buf(sr, 0.12); tone(a, sr, 1700, 0.5, 45); tone(a, sr, 3400, 0.18, 70); noise(a, sr, 0.3, 120, 10000, 2000); return fadeEdges(a, sr); },
    // ゴルフ
    tee(sr) { const a = buf(sr, 0.12); tone(a, sr, 880, 0.4, 45); tone(a, sr, 1760, 0.12, 60); noise(a, sr, 0.2, 120, 5000, 600); return fadeEdges(a, sr); },
    waggle(sr) { const a = buf(sr, 0.16); noise(a, sr, 0.35, 22, 7000, 2500, 0.03); return fadeEdges(a, sr); },
    golfHit(sr) { const a = buf(sr, 0.6); noise(a, sr, 0.5, 60, 12000, 2000); [2100, 3170, 4400].forEach((f, i) => tone(a, sr, f, 0.16 / (i + 1), 7 + i * 3)); sweep(a, sr, 300, 120, 30, 0.3, 25); return fadeEdges(a, sr, 1, 30); },
    cup(sr) { const a = buf(sr, 0.5); tone(a, sr, 700, 0.3, 14); tone(a, sr, 1050, 0.2, 18, 0.09); tone(a, sr, 700, 0.15, 20, 0.16); return fadeEdges(a, sr, 1, 30); },
    splash(sr) { const a = buf(sr, 0.6); noise(a, sr, 0.45, 7, 3500, 300, 0.01); sweep(a, sr, 400, 150, 12, 0.15, 10); return fadeEdges(a, sr, 1, 50); },
    cheer(sr) { // 歓声（ワーッ）
      const a = buf(sr, 1.4); let y1 = 0, y2 = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr; y1 += 0.08 * (rnd() - y1); y2 += 0.02 * (y1 - y2);
        a[i] = 2.2 * (y1 - y2) * Math.min(1, t / 0.2) * Math.max(0, 1 - Math.max(0, t - 0.6) / 0.8) * (1 + 0.2 * Math.sin(TAU * 5 * t));
      }
      return fadeEdges(a, sr, 1, 60);
    },
    whiff(sr) { const a = buf(sr, 0.3); noise(a, sr, 0.3, 10, 2500, 500, 0.08); return fadeEdges(a, sr); },

    // ---- 高品質BGM用（第3版） ----
    ep(sr, n, d) { // FM のエレクトリックピアノ（ローズ風）
      const f = freq(n), dur = d || 1.2, a = buf(sr, dur + 0.3);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr, idx = 0.4 + 2.2 * Math.exp(-t * 6);
        const env = Math.min(1, t / 0.003) * Math.exp(-t * 1.4) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.3) : 1);
        const tine = 0.12 * Math.sin(TAU * f * 7.1 * t) * Math.exp(-t * 30);
        a[i] = 0.3 * env * (Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t)) + tine) * (1 + 0.08 * Math.sin(TAU * 4.5 * t));
      }
      return fadeEdges(a, sr, 1, 20);
    },
    organ(sr, n, d) {
      const f = freq(n), dur = d || 0.8, a = buf(sr, dur + 0.08);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr, ph = TAU * f * t;
        const env = Math.min(1, t / 0.008) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.08) : 1);
        const perc = 0.35 * Math.exp(-t * 9) * Math.sin(3 * ph);
        a[i] = 0.16 * env * (Math.sin(ph) + 0.8 * Math.sin(2 * ph) + 0.5 * Math.sin(4 * ph) + 0.25 * Math.sin(8 * ph) + perc) * (1 + 0.12 * Math.sin(TAU * 6.3 * t));
      }
      return fadeEdges(a, sr);
    },
    str(sr, ns, d) { // スーパーソウのストリングス（和音）
      const notes = ns.split(',').map(freq), dur = d || 2, rel = 0.5, a = buf(sr, dur + rel);
      const dets = [-0.012, -0.005, 0, 0.006, 0.013];
      notes.forEach(f => dets.forEach((dt, j) => {
        let ph = (j * 0.37) % 1;
        for (let i = 0; i < a.length; i++) {
          const t = i / sr; ph += f * (1 + dt) / sr; ph -= Math.floor(ph);
          const env = Math.min(1, t / 0.18) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
          a[i] += env * 0.022 * (2 * ph - 1);
        }
      }));
      let y1 = 0, y2 = 0; const c = coef(2400, sr);
      for (let i = 0; i < a.length; i++) { y1 += c * (a[i] - y1); y2 += c * (y1 - y2); a[i] = y2; }
      return fadeEdges(a, sr);
    },
    lead(sr, n, d) { // リードシンセ（ノコギリ＋矩形、フィルターが開いて閉じる）
      const f = freq(n), dur = d || 0.5, a = buf(sr, dur + 0.12);
      let p1 = 0, p2 = 0, y = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr, vib = 1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, Math.max(0, t - 0.12) / 0.2);
        p1 += f * vib * 1.003 / sr; p1 -= Math.floor(p1); p2 += f * vib * 0.997 / sr; p2 -= Math.floor(p2);
        const x = (2 * p1 - 1) * 0.6 + (p2 < 0.5 ? 0.4 : -0.4);
        y += coef(900 + 3200 * Math.exp(-t * 7), sr) * (x - y);
        const env = Math.min(1, t / 0.01) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 1) * (0.8 + 0.2 * Math.exp(-t * 5));
        a[i] = 0.2 * y * env;
      }
      return fadeEdges(a, sr);
    },
    synb(sr, n, d) { // シンセベース
      const f = freq(n), dur = d || 0.3, a = buf(sr, dur + 0.05);
      let p = 0, y = 0, y2 = 0;
      for (let i = 0; i < a.length; i++) {
        const t = i / sr; p += f / sr; p -= Math.floor(p);
        const c = coef(250 + 1600 * Math.exp(-t * 14), sr);
        y += c * ((2 * p - 1) - y); y2 += c * (y - y2);
        const env = Math.min(1, t / 0.004) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : 1);
        a[i] = env * (0.32 * y2 * 1.6 + 0.3 * Math.sin(TAU * f * t));
      }
      return fadeEdges(a, sr);
    },
    mute(sr, n, d) { return ks(sr, freq(n), d || 0.14, 0.95, 0.9, 0.5); }, // ミュートしたギターの「チャカ」
    gtr(sr, n, d) { return ks(sr, freq(n), d || 1.2, 0.55, 0.996, 0.42); },
    kick2(sr) { const a = buf(sr, 0.45); sweep(a, sr, 160, 48, 32, 0.85, 7); tone(a, sr, 48, 0.25, 5); noise(a, sr, 0.3, 300, 5000, 800); return fadeEdges(a, sr); },
    snare2(sr) { const a = buf(sr, 0.3); sweep(a, sr, 260, 185, 35, 0.32, 18); tone(a, sr, 330, 0.12, 25); noise(a, sr, 0.5, 13, 9000, 1200); noise(a, sr, 0.25, 40, 4000, 300); return fadeEdges(a, sr); },
    hh2(sr, n, d) { // 金属的なハイハット（矩形波6本＋ハイパス）
      const len = d || 0.06, a = buf(sr, len + 0.02), fs = [205.3, 304.4, 369.6, 522.7, 540, 800];
      let y = 0; const c = coef(7000, sr);
      for (let i = 0; i < a.length; i++) {
        const t = i / sr; let x = 0;
        fs.forEach(f => { x += Math.sin(TAU * f * 1.9 * t) > 0 ? 1 : -1; });
        y += c * (x - y);
        a[i] = 0.07 * (x - y) * Math.exp(-t * (len > 0.1 ? 9 : 55));
      }
      noise(a, sr, 0.12, len > 0.1 ? 9 : 60, 0, 8000);
      return fadeEdges(a, sr);
    },
    crash(sr) { const a = buf(sr, 1.8); noise(a, sr, 0.35, 2.4, 0, 4000); noise(a, sr, 0.2, 6, 9000, 2500); return fadeEdges(a, sr, 1, 80); },
    tom(sr, n) { const f = freq(n || 'G2'), a = buf(sr, 0.4); sweep(a, sr, f * 1.6, f, 18, 0.7, 9); noise(a, sr, 0.15, 60, 3000, 200); return fadeEdges(a, sr); },
    rise(sr, n, d) { const dur = d || 1, a = buf(sr, dur); let y = 0; for (let i = 0; i < a.length; i++) { const t = i / sr; y += coef(400 + 7000 * (t / dur) ** 2, sr) * (rnd() - y); a[i] = 0.3 * y * (t / dur) ** 2; } return fadeEdges(a, sr, 1, 10); },
    snap(sr) { const a = buf(sr, 0.12); noise(a, sr, 0.5, 70, 6000, 1500); tone(a, sr, 1900, 0.15, 60); return fadeEdges(a, sr); },
    tamb(sr) { const a = buf(sr, 0.2); noise(a, sr, 0.28, 18, 14000, 7000); tone(a, sr, 5200, 0.05, 30); return fadeEdges(a, sr); },
    splat(sr) { const a = buf(sr, 0.4); noise(a, sr, 0.6, 16, 1800, 100, 0.004); sweep(a, sr, 220, 70, 20, 0.4, 14); return fadeEdges(a, sr); },
    boing(sr) { const a = buf(sr, 0.5); let ph = 0; for (let i = 0; i < a.length; i++) { const t = i / sr, f = 180 + 120 * Math.sin(TAU * 9 * t) * Math.exp(-t * 5) + 160 * t; ph += TAU * f / sr; a[i] = 0.35 * Math.sin(ph) * Math.exp(-t * 5); } return fadeEdges(a, sr); },
    zap(sr) { const a = buf(sr, 0.25); let ph = 0; for (let i = 0; i < a.length; i++) { const t = i / sr, f = 2400 * Math.exp(-t * 18) + 200; ph += TAU * f / sr; a[i] = 0.3 * (Math.sin(ph) > 0 ? 1 : -1) * Math.exp(-t * 10); } let y = 0; const c = coef(5000, sr); for (let i = 0; i < a.length; i++) { y += c * (a[i] - y); a[i] = y; } return fadeEdges(a, sr); },
    rope(sr) { const a = buf(sr, 0.09); noise(a, sr, 0.6, 50, 3500, 300); tone(a, sr, 180, 0.3, 40); return fadeEdges(a, sr); },
    whoosh(sr) { const a = buf(sr, 0.35); let y = 0; for (let i = 0; i < a.length; i++) { const t = i / sr, k = Math.sin(Math.PI * t / 0.35); y += coef(600 + 2500 * k, sr) * (rnd() - y); a[i] = 0.4 * y * k; } return fadeEdges(a, sr); },
    stab(sr, ns, d) { // オーケストラ・ヒット風（キメ用）
      const notes = ns.split(',').map(freq), dur = d || 0.35, a = buf(sr, dur + 0.25);
      notes.forEach(f => [0.996, 1.004].forEach(dt => {
        let ph = 0, y = 0;
        for (let i = 0; i < a.length; i++) {
          const t = i / sr; ph += f * dt / sr; ph -= Math.floor(ph);
          y += coef(1200 + 5000 * Math.exp(-t * 10), sr) * ((2 * ph - 1) - y);
          a[i] += 0.07 * y * Math.min(1, t / 0.005) * Math.exp(-t * (t > dur ? 14 : 2.5));
        }
      }));
      noise(a, sr, 0.15, 30, 6000, 200);
      tone(a, sr, notes[0] / 2, 0.25, 6);
      return fadeEdges(a, sr);
    }
  };

  // 別ファイルから音色を追加する（声の合成など）
  function register(name, fn) { INST[name] = fn; }

  function render(id, sr) {
    const p = id.split(':');
    const fn = INST[p[0]];
    if (!fn) throw new Error('unknown sound ' + id);
    seed = 12345 + id.length * 7919 + id.charCodeAt(id.length - 1);
    return fn(sr, p[1], p[2] !== undefined ? parseFloat(p[2]) : undefined, p);
  }
  return { render, register, has: name => !!INST[name.split(':')[0]] };
})();
