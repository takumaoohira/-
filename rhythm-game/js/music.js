/*
 * 楽曲を書くための小さな道具
 *  - 旋律は「8分音符 × 8マス」の文字列で1小節を書く。 音名=発音 / "-"=のばす / "."=休み
 *      例) "C5 - - D5 E5 - D5 -"
 *  - リズムは "x...x..." のように1小節を文字数で等分（8文字なら8分、16文字なら16分）。"x"=強 "o"=弱
 * 戻り値はどれも { b: 小節内の拍, id: 音色ID, gain } の配列。拍→秒の変換は譜面側（chart.js）で行う。
 */
RG.Music = (function () {
  function line(str, inst, opt = {}) {
    const toks = str.trim().split(/\s+/);
    const step = 4 / toks.length;
    const out = [];
    let cur = null;
    toks.forEach((tk, i) => {
      if (tk === '-') { if (cur) cur.len += step; return; }
      cur = null;
      if (tk === '.') return;
      cur = { b: i * step, note: tk, len: step };
      out.push(cur);
    });
    const spb = opt.spb || 0.5;
    return out.map(n => {
      // 長さは0.1秒単位に丸めて、同じ音色を使い回す
      const dur = opt.fixedDur || Math.max(0.3, Math.round((n.len * spb + (opt.tail || 0.3)) * 10) / 10);
      return { b: n.b, id: `${inst}:${n.note}:${dur}`, gain: opt.gain || 1 };
    });
  }
  function rhythm(str, id, gain = 1, accent = 0.55) {
    const s = str.replace(/\s+/g, '');
    const step = 4 / s.length;
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === 'x') out.push({ b: i * step, id, gain });
      else if (s[i] === 'o') out.push({ b: i * step, id, gain: gain * accent });
    }
    return out;
  }
  // 和音名 → 構成音
  const CHORDS = {
    C: ['C4', 'E4', 'G4'], Am: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'], G: ['G3', 'B3', 'D4'],
    Em: ['E3', 'G3', 'B3'], Dm: ['D3', 'F3', 'A3'], Bb: ['Bb3', 'D4', 'F4'], D: ['D4', 'F#4', 'A4'],
    Bm: ['B3', 'D4', 'F#4'], A: ['A3', 'C#4', 'E4']
  };
  const ROOT = { C: 'C', Am: 'A', F: 'F', G: 'G', Em: 'E', Dm: 'D', Bb: 'Bb', D: 'D', Bm: 'B', A: 'A' };
  function root(ch, oct) { return ROOT[ch] + oct; }
  function chord(ch) { return CHORDS[ch]; }
  // ギター風の分散和音
  function strum(ch, at, inst, gain, spread = 0.03, dur = 1.6) {
    return CHORDS[ch].map((n, i) => ({ b: at + i * spread, id: `${inst}:${n}:${dur}`, gain }));
  }
  return { line, rhythm, chord, root, strum, CHORDS };
})();
