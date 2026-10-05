/*
 * バンド（BGMの編曲エンジン）
 *   RG.Band.bar(info, chart, spec) で1小節分の音を返す。spec：
 *     style   … 'funk' | 'disco' | 'hiphop' | 'lofi' | 'shuffle' | 'ballad' | 'polka' | 'folk' | 'pop'
 *     chord   … 和音名（'Em7' 'A7' 'Cmaj7' 'F#m' など）
 *     mel     … 旋律（8マスの文字列、music.js の書き方）  melInst / melGain / melPan
 *     drums / bass / comp / pad … 各パートの音量の倍率（0で鳴らさない）
 *     clear   … 合図とぶつからないよう、ドラムを抜く拍の一覧（例：[0] → 1拍目のキックを鳴らさない）
 *   セクションの頭でシンバル、次のセクションへ変わる小節の最後でタムのフィルを自動で入れる。
 *   ドラムは中央、ギターは左、鍵盤は右、ストリングスは左右に広げ、BGMには軽い残響をかける。
 */
RG.Band = (function () {
  const M = RG.Music;
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const Q = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 9: [0, 4, 7, 10, 14],
    m9: [0, 3, 7, 10, 14], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6], add9: [0, 4, 7, 14], '7#9': [0, 4, 7, 10, 15]
  };
  const nn = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  const cache = {};
  function chord(name) {
    if (cache[name]) return cache[name];
    const m = /^([A-G])([#b]?)(.*)$/.exec(name || 'C');
    let r = m[1] + (m[2] || ''); if (FLAT[r]) r = FLAT[r];
    const iv = Q[m[3]] || Q[''];
    const pc = NAMES.indexOf(r);
    let base = 48 + pc; if (base < 52) base += 12;               // 和音はE3〜の高さに
    const midi = iv.map(i => base + i).map(x => (x > 74 ? x - 12 : x)).sort((a, b) => a - b);
    return (cache[name] = { name, root: r, pc, iv, midi, notes: midi.map(nn), bass: 36 + pc, minor: iv[1] === 3 });
  }
  const bassNote = (ch, semi, oct = 0) => nn(ch.bass + semi + oct * 12);

  // ---- ドラム ----
  function drums(style, info, g, clear) {
    const ev = [];
    const R = (str, id, gain, pan = 0, rev = 0) => M.rhythm(str, id, gain * g).forEach(e => { e.pan = pan; e.rev = rev; ev.push(e); });
    const at = (b, id, gain, pan = 0, rev = 0) => ev.push({ b, id, gain: gain * g, pan, rev });
    switch (style) {
      case 'funk':
        R('x..x......x.x...', 'kick2', 0.55); R('....x.......x...', 'snare2', 0.45, 0, 0.12);
        R('.......o.o....o.', 'snare2', 0.1, 0.05); R('xoxoxoxoxoxoxoxo', 'hh2', 0.22, 0.25); at(3.5, 'hh2:o:0.3', 0.18, 0.25);
        break;
      case 'disco':
        R('x...x...x...x...', 'kick2', 0.55); R('....x.......x...', 'clap', 0.38, 0, 0.18); R('....x.......x...', 'snare2', 0.18);
        [0.5, 1.5, 2.5, 3.5].forEach(b => at(b, 'hh2:o:0.22', 0.2, 0.25)); R('oxoxoxoxoxoxoxox', 'hh2', 0.12, 0.3);
        break;
      case 'hiphop': case 'lofi': {
        const sw = style === 'lofi' ? 0.58 : 0.55; // はねた8分
        R('x......x..x.....', 'kick2', style === 'lofi' ? 0.45 : 0.6); at(1, 'snare2', 0.42, 0, 0.2); at(3, 'snare2', 0.42, 0, 0.2);
        for (let k = 0; k < 4; k++) { at(k, 'hh2', 0.18, 0.2); at(k + sw, 'hh2', 0.11, 0.2); }
        if (style === 'hiphop') at(2.75, 'snap', 0.15, -0.2, 0.2);
        break;
      }
      case 'shuffle':
        [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3].forEach((b, i) => at(b, 'hh2', i % 2 ? 0.12 : 0.2, 0.25));
        at(0, 'kick2', 0.4); at(2, 'kick2', 0.35); at(1, 'snare2', 0.25, 0, 0.2); at(3, 'snare2', 0.25, 0, 0.2);
        break;
      case 'ballad':
        at(0, 'kick2', 0.4); at(2.5, 'kick2', 0.3); at(1, 'snare2', 0.3, 0, 0.35); at(3, 'snare2', 0.3, 0, 0.35);
        R('x.x.x.x.x.x.x.x.', 'hh2', 0.1, 0.2);
        break;
      case 'polka':
        R('x.......x.......', 'kick2', 0.5); R('....x.......x...', 'snare2', 0.3, 0, 0.1); R('..x...x...x...x.', 'hh2', 0.16, 0.25);
        break;
      case 'folk':
        R('x.......x.......', 'kick2', 0.3); R('..o...o...o...o.', 'shaker', 0.5, 0.3);
        break;
      default: // pop
        R('x.......x.x.....', 'kick2', 0.5); R('....x.......x...', 'snare2', 0.4, 0, 0.15); R('x.x.x.x.x.x.x.x.', 'hh2', 0.16, 0.25);
    }
    let out = ev;
    if (clear && clear.length) out = out.filter(e => !(clear.some(c => Math.abs(c - e.b) < 0.13) && /kick|snare|clap|crash|hh2:o/.test(e.id)));
    // つなぎのフィル（最後の1拍をタムの連打に）
    if (info.fill && style !== 'folk') {
      out = out.filter(e => e.b < 3);
      ['A2', 'G2', 'E2', 'C2'].forEach((n, i) => out.push({ b: 3 + i * 0.25, id: `tom:${n}`, gain: 0.45 * g, pan: 0.3 - i * 0.2, rev: 0.15 }));
    }
    // セクションの頭にシンバル
    if (info.secBar === 0 && !['I', 'count', 'P', 'end'].includes(info.sec) && style !== 'folk') out.push({ b: 0, id: 'crash', gain: 0.32 * g, pan: -0.3, rev: 0.25 });
    return out;
  }

  // ---- ベース ----
  const BASS = {
    funk: [[0, 0, 0.25], [0.75, 12, 0.12], [1.5, 0, 0.2], [2.5, 'b7', 0.2], [3, 7, 0.2], [3.5, 12, 0.12]],
    disco: [[0, 0, 0.2], [0.5, 12, 0.15], [1, 0, 0.2], [1.5, 12, 0.15], [2, 0, 0.2], [2.5, 12, 0.15], [3, 0, 0.2], [3.5, 12, 0.15]],
    hiphop: [[0, 0, 0.7], [1.75, 0, 0.2], [2.5, 'b7', 0.5]],
    lofi: [[0, 0, 0.8], [2.5, 7, 0.4], [3.5, 0, 0.2]],
    shuffle: [[0, 0, 0.5], [1, '3', 0.5], [2, 7, 0.5], [3, '6', 0.5]],
    ballad: [[0, 0, 1.5], [2, 7, 1.0], [3.5, 0, 0.3]],
    polka: [[0, 0, 0.35], [2, 7, 0.35]],
    folk: [[0, 0, 1.0], [2, 7, 0.8]],
    pop: [[0, 0, 0.4], [1.5, 0, 0.2], [2, 7, 0.4], [3.5, 0, 0.2]]
  };
  const BASS_INST = { funk: 'sbass', disco: 'synb', hiphop: 'synb', lofi: 'bass', shuffle: 'bass', ballad: 'bass', polka: 'bass', folk: 'bass', pop: 'sbass' };
  function bass(style, ch, g) {
    const inst = BASS_INST[style] || 'bass';
    return (BASS[style] || BASS.pop).map(([b, s, d]) => {
      const semi = s === 'b7' ? 10 : s === '3' ? ch.iv[1] : s === '6' ? (ch.minor ? 10 : 9) : s;
      return { b, id: `${inst}:${bassNote(ch, semi)}:${d}`, gain: 0.55 * g, pan: 0, rev: 0.03 };
    });
  }

  // ---- 伴奏（ギター・鍵盤） ----
  function comp(style, ch, g, spb) {
    const ev = [];
    const chordAt = (b, inst, dur, gain, pan, rev = 0.15, notes = ch.notes) => notes.forEach((n, i) => ev.push({ b: b + i * 0.012, id: `${inst}:${n}:${dur}`, gain: gain * g, pan, rev }));
    const top3 = ch.notes.slice(-3);
    switch (style) {
      case 'funk':
        [0.25, 0.75, 1.75, 2.25, 2.75, 3.75].forEach(b => chordAt(b, 'mute', 0.12, 0.2, -0.45, 0.05, top3));
        [1.5, 3.25].forEach(b => chordAt(b, 'ep', (spb * 0.6).toFixed(1), 0.2, 0.35));
        break;
      case 'disco':
        [0.5, 1.5, 2.5, 3.5].forEach(b => chordAt(b, 'ep', 0.3, 0.17, 0.35));
        [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75].forEach(b => chordAt(b, 'mute', 0.1, 0.12, -0.5, 0.05, top3.slice(-2)));
        break;
      case 'hiphop': case 'lofi':
        chordAt(0, 'ep', (spb * 2.4).toFixed(1), 0.2, 0.3, 0.3); chordAt(2.5, 'ep', (spb * 1.3).toFixed(1), 0.14, 0.3, 0.3);
        break;
      case 'shuffle':
        [2 / 3, 1 + 2 / 3, 2 + 2 / 3, 3 + 2 / 3].forEach(b => chordAt(b, 'organ', (spb * 0.3).toFixed(1), 0.13, 0.35, 0.1));
        break;
      case 'ballad':
        // 8分の分散和音
        for (let k = 0; k < 8; k++) ev.push({ b: k * 0.5, id: `ep:${ch.notes[k % ch.notes.length]}:${(spb * 1.2).toFixed(1)}`, gain: 0.16 * g, pan: 0.3, rev: 0.35 });
        break;
      case 'polka':
        [1, 3].forEach(b => chordAt(b, 'organ', (spb * 0.35).toFixed(1), 0.13, 0.3, 0.05));
        break;
      case 'folk':
        chordAt(0, 'gtr', 1.6, 0.34, -0.35, 0.15); chordAt(2, 'gtr', 1.2, 0.24, -0.35, 0.15); chordAt(3, 'gtr', 0.6, 0.14, -0.35, 0.15);
        break;
      default:
        chordAt(0, 'gtr', 1.2, 0.26, -0.4); chordAt(1.5, 'gtr', 0.5, 0.16, -0.4); chordAt(2, 'gtr', 1.0, 0.22, -0.4); chordAt(3.5, 'gtr', 0.4, 0.14, -0.4);
    }
    return ev;
  }

  function pad(ch, g, spb) {
    const dur = (spb * 4).toFixed(1);
    return [
      { b: 0, id: `str:${ch.notes.join(',')}:${dur}`, gain: 0.32 * g, pan: -0.45, rev: 0.4 },
      { b: 0, id: `str:${ch.notes.map(n => n.replace(/(-?\d)$/, d => +d + 1)).join(',')}:${dur}`, gain: 0.2 * g, pan: 0.45, rev: 0.4 }
    ];
  }

  function bar(info, chart, spec) {
    const style = spec.style || 'pop', spb = chart.spb, ch = chord(spec.chord || info.chord || 'C');
    const ev = [];
    const v = (k, d = 1) => (spec[k] === undefined ? d : spec[k]);
    let clear = spec.clear;
    if (spec.clearCues) { // いまのパターンで合図が鳴る拍は、キック・スネア・手拍子を抜いて合図を聞こえやすくする
      const pat = chart.game.patterns[info.p];
      const cb = pat && pat.cues ? pat.cues.map(c => c.b - (info.pbar || 0) * 4).filter(b => b >= 0 && b < 4) : [];
      clear = (clear || []).concat(cb);
    }
    if (v('drums') > 0) ev.push(...drums(style, info, v('drums'), clear));
    if (v('bass') > 0) ev.push(...bass(style, ch, v('bass')));
    if (v('comp') > 0) ev.push(...comp(style, ch, v('comp'), spb));
    if (v('pad', 0) > 0) ev.push(...pad(ch, v('pad', 0), spb));
    if (spec.mel) M.line(spec.mel, spec.melInst || 'lead', { spb, gain: spec.melGain || 0.4, tail: 0.15 }).forEach(e => { e.pan = spec.melPan || 0.1; e.rev = 0.25; ev.push(e); });
    return ev;
  }
  // 締めの「ジャーン」
  function ending(chordName, g = 1) {
    const ch = chord(chordName);
    return [
      { b: 0, id: 'kick2', gain: 0.6 * g }, { b: 0, id: 'crash', gain: 0.4 * g, pan: -0.3, rev: 0.3 },
      { b: 0, id: `stab:${ch.notes.join(',')}:0.6`, gain: 0.55 * g, rev: 0.4 },
      { b: 0, id: `str:${ch.notes.join(',')}:1.6`, gain: 0.35 * g, pan: -0.4, rev: 0.5 },
      { b: 0, id: `synb:${bassNote(ch, 0)}:1.2`, gain: 0.5 * g }
    ];
  }
  return { bar, chord, ending, nn };
})();
