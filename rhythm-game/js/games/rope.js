/*
 * ミニゲーム⑨「ストリート・ダブルダッチ」（ダンス）
 *   2人が回す縄が地面に着く瞬間にジャンプ（タップ）。縄が振り下ろされる「ヒュッ」が合図。
 *     ふつう        → 2拍目・4拍目（スネアと同じ）
 *     「ダブル！」   → 半拍ごと（2拍目から5回）
 *     「スイッチ！」 → 裏拍（2拍目の裏・4拍目の裏）
 *     「ストップ！」 → 縄が止まる。跳んだら転ぶ（余分な入力）
 */
(function () {
  const { U, D } = RG;
  const J = (ins, call, extra = {}) => Object.assign({
    len: 4,
    cues: [...(call ? [{ b: 0, type: call }] : []), ...ins.map((b, i) => ({ b: b - 0.25, type: 'swish', for: i }))],
    inputs: ins.map(b => ({ b, type: 'jump' }))
  }, extra);
  const patterns = {
    J: J([1, 3]),
    D: J([1, 1.5, 2, 2.5, 3], 'double'),
    S: J([1.5, 3.5], 'switch'),
    X: { len: 4, cues: [{ b: 0, type: 'stop' }], inputs: [], activeAlways: true, active: [0.4, 3.8] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  patterns.J.cues.sort((a, b) => a.b - b.b); patterns.D.cues.sort((a, b) => a.b - b.b); patterns.S.cues.sort((a, b) => a.b - b.b);
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'ストリート・ダブルダッチ！' },
    { p: 'rest', sec: 'I', guide: '縄が地面に着く瞬間（スネアの音）にジャンプ' },
    ...seq('J J J J J J', 'A'),
    { p: 'rest', sec: 'I', guide: '「ダブル！」は半拍ごとに跳ぶ' },
    ...seq('D J D J D J', 'B'),
    { p: 'rest', sec: 'I', guide: '「スイッチ！」は裏で、「ストップ！」は跳ばない' },
    ...seq('S J X S D X S J', 'C'),
    { p: 'fin', sec: 'end', guide: 'ナイス・ステップ！' }
  ];
  const hard = {
    bpm: 112,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 大会決勝' },
      { p: 'rest', sec: 'I', guide: 'ふつう=2・4拍／ダブル=半拍／スイッチ=裏／ストップ=跳ばない' },
      ...seq('J D S J X D', 'A'),
      ...seq('S D X S D S', 'B', 'スイッチの連続！'),
      ...seq('D S X D S X D S', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'ナイス・ステップ！' }
    ]
  };
  const lessons = [
    { p: 'J', title: 'ふつうのジャンプ', hint: 'ヒュッ・ピョン（2拍目と4拍目）' },
    { p: 'D', title: 'ダブル', hint: '「ダブル！」→ 半拍ごとに5回' },
    { p: 'S', title: 'スイッチ', hint: '「スイッチ！」→ 裏拍で跳ぶ' },
    { p: 'X', title: 'ストップ', hint: '「ストップ！」→ 跳ばずにガマン' }
  ];

  const PROG = { A: ['Cm9', 'Fm9'], B: ['G#maj7', 'G7#9', 'Cm9', 'Fm9'], C: ['Cm9', 'G#maj7', 'Fm9', 'G7#9'], P: ['Cm9', 'Fm9'], I: ['G7#9'], count: ['Cm9'], end: ['Cm9'] };
  const HOOK = { B: ['. . G5 . D#5 . C5 .', '. . . . . . . .'], C: ['C6 . . A#5 . G5 . .', '. . D#5 . F5 . G5 .'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [{ b: 1, id: 'snare2', gain: 0.4 }, { b: 3, id: 'snare2', gain: 0.4 }];
    if (sec === 'end') return RG.Band.ending('Cm9');
    if (info.p === 'X') return [{ b: 0, id: 'kick2', gain: 0.5 }, { b: 0, id: 'crash', gain: 0.25, rev: 0.3 }]; // ストップ：音楽も止まる
    return RG.Band.bar(info, chart, { style: 'hiphop', chord: info.chord, drums: 0.85, comp: 0.8, bass: 0.95, clear: [0], pad: sec === 'C' ? 0.15 : 0, mel: HOOK[sec] ? HOOK[sec][info.secBar % 2] : null, melInst: 'ep', melGain: 0.45, melPan: 0.25 });
  }
  function hitSounds(tg, kind) {
    const s = [{ id: 'rope', gain: 0.9 }, { id: 'snap', gain: 0.5 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.3 });
    return s;
  }
  function preload() { return ['rope', 'snap', 'sparkle', 'boing', 'whoosh']; }

  // ---------------- 描画 ----------------
  const LH = { x: 54, y: 352 }, RH = { x: 306, y: 352 }, GROUND = 470, TOP = 210;
  function turner(g, x, y, beat, flip, color, cap) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y); g.scale(flip, 1);
    D.rrect(g, -18, 0, 36, 56, 12, color, ink, 2.5);
    D.line(g, -8, 56, -10, 100, ink, 8); D.line(g, 8, 56, 10, 100, ink, 8);
    D.circ(g, 0, -20, 20, '#d9a36a', ink, 2.5);
    g.beginPath(); g.moveTo(-14, -34); g.lineTo(-10, -52); g.lineTo(-2, -38); g.fillStyle = '#d9a36a'; g.fill(); g.stroke(); // 耳
    g.beginPath(); g.moveTo(14, -34); g.lineTo(10, -52); g.lineTo(2, -38); g.fill(); g.stroke();
    D.rrect(g, -20, -40, 40, 10, 4, cap, ink, 2); D.rrect(g, 8, -36, 22, 6, 3, cap, ink, 1.5); // キャップ
    D.shades(g, 0, -22, 7, 5);
    g.restore();
  }
  function jumper(g, x, y, beat, h, mood, cool) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - h);
    const tuck = h > 10 ? 1 : 0;
    D.line(g, -8, 40, -10 + tuck * 6, 70 - tuck * 14, ink, 9); D.line(g, 8, 40, 10 - tuck * 6, 70 - tuck * 14, ink, 9);
    D.ell(g, -12 + tuck * 6, 72 - tuck * 14, 9, 5, '#ff3d8b', ink, 2); D.ell(g, 12 - tuck * 6, 72 - tuck * 14, 9, 5, '#ff3d8b', ink, 2);
    D.rrect(g, -22, -6, 44, 50, 14, '#ffc23a', ink, 2.5); // パーカー
    D.text(g, '★', 0, 16, 16, '#ff3d8b');
    const arm = h > 10 ? -2.4 : -0.6;
    [-1, 1].forEach(s => { g.save(); g.translate(s * 18, 0); g.rotate(s * arm); D.line(g, 0, 0, 0, 26, ink, 9); D.line(g, 0, 0, 0, 26, '#ffc23a', 6); g.restore(); });
    D.circ(g, 0, -22, 22, '#f2f2f2', ink, 2.5); // 犬
    D.ell(g, -20, -18, 7, 14, '#8a5a3a', ink, 2); D.ell(g, 20, -18, 7, 14, '#8a5a3a', ink, 2);
    if (mood === 'dizzy') D.eyes(g, 0, -24, 8, 3.5, 'dizzy'); else if (cool) D.shades(g, 0, -24, 8, 5.5); else D.eyes(g, 0, -24, 8, 3.5, mood === 'happy' ? 'happy' : 'normal');
    D.ell(g, 0, -14, 4, 3, ink);
    D.mouth(g, 0, -8, 5, mood === 'dizzy' ? 'wavy' : 'smile');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastHit: -99, lastExtra: -99 };
    // 縄の位相：地面に着く時刻（判定対象の拍）の間を1周とする。止まる小節では地面で止まる
    function ropePhase(beat) {
      let prev = null, next = null;
      for (const tg of chart.inputs) { if (tg.beat <= beat) prev = tg.beat; else { next = tg.beat; break; } }
      if (prev === null && next !== null) prev = next - 2;
      if (next === null || prev === null || next - prev > 2.6) return null;
      return (beat - prev) / (next - prev);
    }
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        if (kind === 'miss') st.lastMiss = at; else st.lastHit = at;
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat, r) { st.lastTap = vbeat; if (r && r.kind === 'extra') { st.lastExtra = vbeat; st.lastMiss = vbeat; } },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 夜の路地：れんがの壁とグラフィティ
        g.fillStyle = '#1b1430'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#3a2440';
        for (let r = 0; r < 12; r++) for (let c = -2; c < 10; c++) g.fillRect(c * 44 + (r % 2) * 22 + 2, 60 + r * 26, 40, 22);
        g.save(); g.translate(180, 150); g.rotate(-0.08);
        D.text(g, 'DOUBLE', -6, -22, 40, '#ff3d8b', '#1a0b26'); D.text(g, 'DUTCH', 10, 22, 40, '#1fc7b6', '#1a0b26');
        g.restore();
        D.line(g, 330, 40, 330, 330, '#555', 5); D.circ(g, 330, 40, 10, '#ffe28a'); // 街灯
        g.fillStyle = '#2a2a38'; g.fillRect(view.x0, 460, view.x1 - view.x0, view.y1 - 460);
        D.line(g, view.x0, 460, view.x1, 460, '#ffc23a', 3);
        // 観客
        for (let i = 0; i < 8; i++) { const x = 20 + i * 46, up = (combo >= 10 ? 8 : 3) * U.hop(beat + (i % 2) * 0.5); D.circ(g, x, 498 - up, 14, '#0f0a1c'); D.ell(g, x, 540 - up, 20, 26, '#0f0a1c'); }

        // 縄
        const u = ropePhase(beat);
        const ropeY = ph => { const p = ((ph % 1) + 1) % 1; return GROUND + 10 - (GROUND + 10 - TOP) * Math.sin(Math.PI * p); };
        const drawRope = (y, col) => { g.beginPath(); g.moveTo(LH.x + 24, LH.y + 20); g.quadraticCurveTo(180, 2 * y - (LH.y + 20), RH.x - 24, RH.y + 20); g.lineWidth = 4; g.strokeStyle = col; g.stroke(); };
        if (u === null) { g.beginPath(); g.moveTo(LH.x + 24, LH.y + 20); g.quadraticCurveTo(180, GROUND + 30, RH.x - 24, RH.y + 20); g.lineWidth = 4; g.strokeStyle = '#ff7a1a'; g.stroke(); }
        else { drawRope(ropeY(u + 0.5), '#1fc7b6'); }
        turner(g, LH.x, LH.y, beat, 1, '#1fc7b6', '#ff3d8b');
        turner(g, RH.x, RH.y, beat, -1, '#ff3d8b', '#1fc7b6');
        // ジャンパー
        const dt = beat - st.lastTap, dm = beat - st.lastMiss;
        const h = fin !== null ? 40 * Math.abs(Math.sin(fin * Math.PI)) : dt >= -0.1 && dt < 0.42 ? Math.sin(Math.PI * U.clamp((dt + 0.1) / 0.52, 0, 1)) * 46 : 0;
        const dizzy = dm >= 0 && dm < 1;
        jumper(g, 180, 382 + (dizzy ? 14 : 0), beat, dizzy ? 0 : h, dizzy ? 'dizzy' : beat - st.lastHit < 0.5 ? 'happy' : 'normal', combo >= 10);
        if (u !== null) drawRope(ropeY(u), '#ff7a1a'); // 手前の縄
        if (dizzy) { for (let k = 0; k < 3; k++) D.star(g, 180 + Math.cos(beat * 6 + k * 2) * 26, 340 + Math.sin(beat * 6 + k * 2) * 8, 6, 2.5, 5, 0, '#ffe066'); }
        if (beat - st.lastExtra < 1) D.text(g, 'ドテッ', 230, 370, 18, '#fff', '#1a0b26');

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 250); g.scale(s, s); g.rotate(-0.06);
          D.text(g, 'ナイス・ステップ！', 0, 0, 28, '#ffe066', '#1a0b26');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#1b1430'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.fillStyle = '#2a2a38'; g.fillRect(0, 84, 100, 16);
    const p = (t * 1.5) % 1, y = 90 - 70 * Math.sin(Math.PI * p);
    g.beginPath(); g.moveTo(6, 60); g.quadraticCurveTo(50, 2 * y - 60, 94, 60); g.lineWidth = 2.5; g.strokeStyle = '#ff7a1a'; g.stroke();
    g.save(); g.translate(50, 54); g.scale(0.5, 0.5); jumper(g, 0, 0, t * 2, Math.abs(Math.sin(t * Math.PI * 1.5)) * 30, 'happy', true); g.restore();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.rope = {
    id: 'rope', title: 'ストリート・ダブルダッチ', color: '#1fc7b6', group: 'dance', level: 3,
    howto: '縄が地面に着く瞬間にジャンプ。「ダブル！」は半拍ごと、「スイッチ！」は裏、「ストップ！」は跳ばない',
    bpm: 100, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      swish: { id: 'whoosh', gain: 0.55 },
      double: { id: 'voice:lady:ダブル！', gain: 1.5, say: 'ダブル！', who: 'left', len: 0.9 },
      switch: { id: 'voice:lady:スイッチ！', gain: 1.3, say: 'スイッチ！', who: 'left', len: 0.9 },
      stop: { id: 'voice:boss:ストップ！', gain: 1.4, say: 'ストップ！', who: 'right', len: 1.2 },
      fin: [{ id: 'voice:crowd:イェーイ！', gain: 1.1, bus: 'voice', say: 'イェーイ！', who: 'crowd' }, { id: 'cheer', gain: 0.8 }]
    },
    missSound: 'boing',
    anchors: { left: { x: 60, y: 300 }, right: { x: 300, y: 300 }, crowd: { x: 180, y: 470 }, you: { x: 180, y: 320 } },
    quips: {
      miss: [{ id: 'voice:kid:イテテ', say: 'イテテ', who: 'you' }, { id: 'voice:kid:カラマッタ〜', say: 'からまった〜', who: 'you' }],
      extra: [{ id: 'voice:boss:トマッテルヨ！', say: '止まってるよ！', who: 'right' }],
      combo: [{ id: 'voice:crowd:フゥー！', say: 'フゥー！', who: 'crowd' }, { id: 'voice:lady:ヤルジャン！', say: 'やるじゃん！', who: 'left' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
