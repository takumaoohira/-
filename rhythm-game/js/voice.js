/*
 * キャラクターの声（フォルマント合成。録音した声は使っていません＝仮素材）
 *   音色ID： "voice:<キャラ>:<カタカナ>"                 … しゃべる（抑揚つき。「！」で語尾が上がって強く、「？」で上がる）
 *            "voice:<キャラ>:<カタカナ>:<音名>:<秒>"     … 歌う（その音の高さ・長さで）
 *   例） voice:boss:ハイ！   voice:uncle:ラー:G4:0.6
 * 母音は声道の共鳴（フォルマント）3本、子音は破裂・摩擦・鼻音・はじき音・半母音で作ります。
 * RG.Voice.onset(id) で「最初の母音が始まる時刻」が分かるので、合図の声は母音の頭を拍に合わせて予約します。
 */
RG.Voice = (function () {
  const TAU = Math.PI * 2;
  // f0：声の高さ、fs：声の大きさ（フォルマントの倍率）、rate：話す速さ、swing：抑揚の大きさ
  const PRESETS = {
    boss: { f0: 105, fs: 0.95, rate: 1.0, swing: 0.35, breath: 0.05 },        // ダンスの先生（低い）
    kid: { f0: 290, fs: 1.3, rate: 1.15, swing: 0.4, breath: 0.03 },          // 宇宙人・小さいキャラ
    lady: { f0: 225, fs: 1.17, rate: 1.0, swing: 0.35, breath: 0.06 },
    uncle: { f0: 128, fs: 1.0, rate: 0.95, swing: 0.3, breath: 0.07, vib: 0.035 }, // カラオケのおじさん（こぶし多め）
    gorilla: { f0: 82, fs: 0.84, rate: 0.9, swing: 0.45, growl: 0.5, breath: 0.08 },
    duck: { f0: 250, fs: 1.22, rate: 1.25, swing: 0.5, nasal: 0.7 },
    robo: { f0: 150, fs: 1.0, rate: 1.0, swing: 0, robot: true },
    clown: { f0: 170, fs: 1.1, rate: 1.1, swing: 0.6, breath: 0.05 },
    penguin: { f0: 240, fs: 1.25, rate: 1.1, swing: 0.4, nasal: 0.3 },
    crowd: { f0: 190, fs: 1.1, rate: 1.0, swing: 0.3, chorus: 6, breath: 0.12 }
  };
  // 母音のフォルマント（成人男性の目安、Hz）と強さ
  const VOW = { a: [800, 1200, 2550], i: [300, 2250, 3000], u: [340, 1400, 2400], e: [480, 1900, 2550], o: [500, 850, 2500] };

  // ---- カタカナ → 音素 ----
  const ROWS = [
    ['アイウエオ', ''], ['カキクケコ', 'k'], ['ガギグゲゴ', 'g'], ['サシスセソ', 's'], ['ザジズゼゾ', 'z'],
    ['タチツテト', 't'], ['ダヂヅデド', 'd'], ['ナニヌネノ', 'n'], ['ハヒフヘホ', 'h'], ['バビブベボ', 'b'],
    ['パピプペポ', 'p'], ['マミムメモ', 'm'], ['ラリルレロ', 'r'], ['ヤ_ユ_ヨ', 'y'], ['ワ___ヲ', 'w']
  ];
  const KANA = {};
  ROWS.forEach(([s, c]) => [...s].forEach((ch, i) => { if (ch !== '_') KANA[ch] = { c, v: 'aiueo'[i] }; }));
  Object.assign(KANA, {
    'シ': { c: 'sh', v: 'i' }, 'ジ': { c: 'j', v: 'i' }, 'チ': { c: 'ch', v: 'i' }, 'ツ': { c: 'ts', v: 'u' }, 'フ': { c: 'f', v: 'u' },
    'ヲ': { c: '', v: 'o' }, 'ヴ': { c: 'b', v: 'u' }
  });
  const SMALL_Y = { 'ャ': 'a', 'ュ': 'u', 'ョ': 'o' };
  const SMALL_V = { 'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o' };

  function parse(text) {
    const t = [...text.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))];
    const out = [];
    for (const ch of t) {
      const last = out[out.length - 1];
      if (KANA[ch]) out.push({ c: KANA[ch].c, v: KANA[ch].v, len: 1 });
      else if (SMALL_Y[ch] && last && last.v) { last.v = SMALL_Y[ch]; if (!['sh', 'j', 'ch'].includes(last.c)) last.pal = true; }
      else if (SMALL_V[ch] && last && last.v) { last.v = SMALL_V[ch]; if (last.c === '' && (last.v === 'a' || last.v === 'i' || last.v === 'e' || last.v === 'o')) last.c = 'w'; }
      else if (ch === 'ー' || ch === '〜' || ch === '~') { if (last && last.v) last.len += 1; if (last && ch !== 'ー') last.glide = true; }
      else if (ch === 'ッ') out.push({ gem: true });
      else if (ch === 'ン') out.push({ c: 'N', v: null, len: 1 });
      else if (ch === '！' || ch === '!') out.push({ mark: '!' });
      else if (ch === '？' || ch === '?') out.push({ mark: '?' });
      else if (ch === '、' || ch === ' ' || ch === '・') out.push({ pause: true });
    }
    return out;
  }

  // 音素の並び → 時間つきの区間
  function plan(text, P, singDur) {
    const ph = parse(text);
    const marks = ph.filter(x => x.mark).map(x => x.mark);
    const moras = ph.filter(x => !x.mark);
    const rate = P.rate || 1;
    const segs = [];
    let t = 0, onset = null;
    const add = (type, dur, o) => { segs.push(Object.assign({ type, t0: t, t1: t + dur }, o)); t += dur; };
    const voicedMoras = moras.filter(m => m.v || m.c === 'N').reduce((a, m) => a + (m.len || 1), 0) || 1; // のばす音（ー）は長さ2として数える
    // 歌うときは、指定の長さに母音をのばす
    let vowelBase = 0.105 / rate;
    if (singDur) vowelBase = Math.max(0.05, (singDur - 0.04 * moras.length) / voicedMoras);
    moras.forEach((m, i) => {
      if (m.pause) { add('sil', 0.07 / rate); return; }
      if (m.gem) { add('sil', 0.07 / rate); return; }
      if (m.c === 'N') { add('nasal', (singDur ? vowelBase : 0.085 / rate) * m.len, { v: 'u', i }); return; }
      const c = m.c;
      // 子音
      if ('kgtdpb'.includes(c[0]) && c.length === 1) {
        add('sil', (c === 'g' || c === 'd' || c === 'b' ? 0.018 : 0.028) / rate, { voicebar: 'gdb'.includes(c) });
        const bp = { k: 2200, g: 1900, t: 4200, d: 3600, p: 900, b: 700 }[c] * (m.v === 'i' || m.pal ? 1.25 : 1);
        add('burst', 0.016, { bp, amp: 'gdb'.includes(c) ? 0.25 : 0.55, voiced: 'gdb'.includes(c) });
        if ('ktp'.includes(c)) add('asp', 0.022 / rate, { v: m.v });
      } else if (c === 's' || c === 'sh' || c === 'z' || c === 'j' || c === 'ts' || c === 'ch') {
        if (c === 'ts' || c === 'ch') { add('sil', 0.022 / rate); add('burst', 0.012, { bp: c === 'ts' ? 5000 : 3300, amp: 0.5 }); }
        add('fric', (c === 'z' || c === 'j' ? 0.045 : c === 'ts' || c === 'ch' ? 0.04 : 0.075) / rate, { bp: c === 's' || c === 'z' || c === 'ts' ? 5200 : 3000, q: c === 's' || c === 'z' || c === 'ts' ? 2.5 : 1.4, amp: 0.4, voiced: c === 'z' || c === 'j' });
      } else if (c === 'h') add('asp', 0.05 / rate, { v: m.v, amp: 0.5 });
      else if (c === 'f') add('fric', 0.05 / rate, { bp: 1600, q: 0.8, amp: 0.25 });
      else if (c === 'n' || c === 'm') add('nasal', 0.045 / rate, { v: m.v, i });
      else if (c === 'r') add('flap', 0.022 / rate, { v: m.v, i });
      else if (c === 'y') add('glideFrom', 0.04 / rate, { from: 'i', v: m.v, i });
      else if (c === 'w') add('glideFrom', 0.04 / rate, { from: 'u', v: m.v, i });
      if (m.pal && c !== 'y') add('glideFrom', 0.03 / rate, { from: 'i', v: m.v, i });
      if (onset === null) onset = t;
      add('vowel', vowelBase * m.len, { v: m.v, i, glide: m.glide });
    });
    add('sil', 0.06);
    return { segs, onset: onset === null ? 0 : onset, total: t, marks, n: moras.length };
  }

  function preset(name) { return PRESETS[name] || PRESETS.boss; }

  function onset(id) {
    const p = id.split(':');
    const pl = plan(p[2] || '', preset(p[1]), p[4] ? parseFloat(p[4]) : 0);
    return pl.onset;
  }

  // 1人分の声を合成
  function synthOne(sr, P, pl, opt) {
    const a = new Float32Array(Math.ceil(sr * (pl.total + 0.05)));
    const fs = P.fs * (opt.fsMul || 1);
    const exclaim = pl.marks.includes('!'), question = pl.marks.includes('?');
    let seed = opt.seed || 99;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    // 声の高さ（しゃべり：最初に上がって、だんだん下がる。歌：一定＋ビブラート）
    const f0At = (t) => {
      if (opt.singF) {
        const vib = 1 + (P.vib || 0.012) * Math.sin(TAU * 5.6 * t) * Math.min(1, Math.max(0, t - 0.12) / 0.15);
        const scoop = 1 - 0.06 * Math.exp(-t * 25); // 少ししゃくり上げる
        return opt.singF * vib * scoop;
      }
      const u = t / pl.total, sw = P.swing;
      let k = 1 + sw * 0.5 * Math.sin(Math.PI * Math.min(1, u * 2.2)) - sw * 0.35 * u;
      if (exclaim) k += sw * 0.9 * Math.max(0, u - 0.55) / 0.45;
      if (question) k += sw * 1.4 * Math.max(0, u - 0.6) / 0.4;
      return P.f0 * (opt.f0Mul || 1) * k * (1 + 0.004 * Math.sin(TAU * 4.8 * t));
    };
    // 区間ごとの目標値
    const target = (seg) => {
      if (!seg) return { F: VOW.a, V: 0, N: 0 };
      switch (seg.type) {
        case 'vowel': return { F: VOW[seg.v], V: 1, N: P.breath || 0.03 };
        case 'nasal': return { F: [260, 1100, 2300], V: 0.55, N: 0, nasal: true };
        case 'flap': return { F: [320, 1350, 2200], V: 0.55, N: 0 };
        case 'glideFrom': return { F: VOW[seg.from], V: 0.75, N: 0 };
        case 'asp': return { F: VOW[seg.v], V: 0, N: seg.amp || 0.35, asp: true };
        case 'fric': return { F: VOW.a, V: seg.voiced ? 0.35 : 0, N: seg.amp, fric: seg };
        case 'burst': return { F: VOW.a, V: seg.voiced ? 0.3 : 0, N: seg.amp, fric: { bp: seg.bp, q: 1.2 } };
        default: return { F: VOW.a, V: seg.voicebar ? 0.12 : 0, N: 0 };
      }
    };
    let si = 0, F = [...VOW.a], V = 0, Nn = 0;
    const res = [0, 0, 0].map(() => ({ y1: 0, y2: 0 }));
    const nf = { y1: 0, y2: 0 };
    let ph = 0, tilt = 0, sub = 0;
    const bw = [90, 110, 150];
    const famp = [1, 0.75, 0.45];
    const f4 = { y1: 0, y2: 0 };
    for (let i = 0; i < a.length; i++) {
      const t = i / sr;
      while (si < pl.segs.length - 1 && t >= pl.segs[si].t1) si++;
      const seg = pl.segs[si];
      const tg = target(seg);
      // なめらかに移る（フォルマントは約25ms、音量は約8ms）
      const kF = 1 - Math.exp(-1 / (0.012 * sr)), kA = 1 - Math.exp(-1 / (0.006 * sr));
      for (let j = 0; j < 3; j++) F[j] += kF * (tg.F[j] * (j === 0 ? 1 : 1) - F[j]);
      V += kA * (tg.V - V); Nn += kA * (tg.N - Nn);
      // 声帯の音（ノコギリ波を少し丸めたもの）
      const f0 = f0At(t);
      ph += f0 / sr; if (ph >= 1) { ph -= 1; sub = -sub || 1; }
      let src = (1 - 2 * ph);
      tilt += 0.6 * (src - tilt); src = tilt;
      if (P.growl) src *= 1 + P.growl * sub * 0.6 * (0.5 + 0.5 * Math.sin(TAU * 31 * t));
      if (P.robot) src = (ph < 0.5 ? 1 : -1) * 0.7;
      const asp = rnd();
      let ex = src * V + asp * (tg.asp ? Nn : (P.breath || 0) * V * 0.6);
      // フォルマント（並列の共鳴フィルター）
      let out = 0;
      for (let j = 0; j < 3; j++) {
        const fj = Math.min(F[j] * fs, sr * 0.45), r = Math.exp(-Math.PI * bw[j] * fs / sr);
        const c = 2 * r * Math.cos(TAU * fj / sr), g = (1 - r * r) * 0.5;
        const y = g * ex + c * res[j].y1 - r * r * res[j].y2;
        res[j].y2 = res[j].y1; res[j].y1 = y;
        out += y * famp[j] * (tg.nasal && j > 0 ? 0.25 : 1);
      }
      { // 第4フォルマント（声の明るさ）
        const fj = Math.min(3500 * fs, sr * 0.45), r = Math.exp(-Math.PI * 250 / sr), c = 2 * r * Math.cos(TAU * fj / sr);
        const y = (1 - r * r) * 0.5 * ex + c * f4.y1 - r * r * f4.y2; f4.y2 = f4.y1; f4.y1 = y; out += y * 0.3 * (tg.nasal ? 0.2 : 1);
      }
      if (P.nasal) out += P.nasal * 0.6 * src * V * Math.sin(TAU * 1100 * fs * t) * 0.15;
      // 摩擦音・破裂音のノイズ
      if (tg.fric && Nn > 0.001) {
        const fc = tg.fric.bp * Math.min(1.3, fs), r = Math.exp(-Math.PI * fc / (tg.fric.q * 4) / sr);
        const c = 2 * r * Math.cos(TAU * fc / sr);
        const y = (1 - r * r) * 0.5 * asp + c * nf.y1 - r * r * nf.y2;
        nf.y2 = nf.y1; nf.y1 = y;
        out += y * Nn * 2.2;
      }
      if (P.robot) out *= 0.6 + 0.4 * Math.sin(TAU * 55 * t);
      a[i] = out * (exclaim ? 1.15 : 1);
    }
    return a;
  }

  function render(sr, who, text, singNote, singDur) {
    const P = preset(who);
    const dur = singDur ? parseFloat(singDur) : 0;
    const pl = plan(text || 'ア', P, dur);
    const singF = singNote ? RG.U.freq(singNote) : 0;
    let a;
    if (P.chorus) {
      a = new Float32Array(Math.ceil(sr * (pl.total + 0.12)));
      for (let k = 0; k < P.chorus; k++) {
        const one = synthOne(sr, P, pl, { seed: 31 + k * 17, f0Mul: 0.82 + 0.07 * k, fsMul: 0.9 + 0.05 * (k % 4), singF: singF ? singF * (1 + (k - 2.5) * 0.006) : 0 });
        const off = Math.floor(sr * 0.012 * k);
        for (let i = 0; i < one.length && i + off < a.length; i++) a[i + off] += one[i];
      }
    } else a = synthOne(sr, P, pl, { singF });
    // 音量をそろえる
    let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
    const g = m > 0 ? 0.75 / m : 1;
    for (let i = 0; i < a.length; i++) a[i] *= g;
    const fade = Math.min(a.length, Math.floor(sr * 0.01));
    for (let i = 0; i < fade; i++) a[a.length - 1 - i] *= i / fade;
    return a;
  }

  RG.Synth.register('voice', (sr, who, _d, p) => render(sr, who, p[2], p[3], p[4]));
  return { onset, parse, PRESETS };
})();
