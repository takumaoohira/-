/*
 * ミニゲーム⑥「ディスコ・フリーズ」（ダンス）
 *   ステージの Mr.ボンバー（先生）が声で振り付けを呼ぶ。きみはダンサー4人目。
 *     「ハイ！」    → 次の拍でポーズ
 *     「クラップ！」 → 次の拍と、その裏で手拍子（2回）
 *     「ターン！」   → くるっと回って、2拍あとにポーズ
 *     「フリーズ！」 → 全員ピタッと止まる。押したら負け（余分な入力）
 */
(function () {
  const { U, D } = RG;
  const patterns = {
    H: { len: 4, cues: [{ b: 0, type: 'hai' }], inputs: [{ b: 1, type: 'hai' }] },
    HH: { len: 4, cues: [{ b: 0, type: 'hai' }, { b: 2, type: 'hai' }], inputs: [{ b: 1, type: 'hai' }, { b: 3, type: 'hai' }] },
    C: { len: 4, cues: [{ b: 0, type: 'clap' }], inputs: [{ b: 1, type: 'clap' }, { b: 1.5, type: 'clap' }] },
    HC: { len: 4, cues: [{ b: 0, type: 'hai' }, { b: 2, type: 'clap' }], inputs: [{ b: 1, type: 'hai' }, { b: 3, type: 'clap' }, { b: 3.5, type: 'clap' }] },
    CC: { len: 4, cues: [{ b: 0, type: 'clap' }, { b: 2, type: 'clap' }], inputs: [{ b: 1, type: 'clap' }, { b: 1.5, type: 'clap' }, { b: 3, type: 'clap' }, { b: 3.5, type: 'clap' }] },
    T: { len: 4, cues: [{ b: 0, type: 'turn' }], inputs: [{ b: 2, type: 'turn' }] },
    F: { len: 4, cues: [{ b: 0, type: 'freeze' }], inputs: [], activeAlways: true, active: [0.3, 3.8] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'ディスコ・フリーズ、レッツダンス！' },
    { p: 'rest', sec: 'I', guide: '「ハイ！」の次の拍でポーズ！' },
    ...seq('H H HH H HH HH', 'A'),
    { p: 'rest', sec: 'I', guide: '「クラップ！」は手拍子2回（拍と、その裏）' },
    ...seq('C H C HH HC C', 'B'),
    { p: 'rest', sec: 'I', guide: '「ターン！」は2拍あと。「フリーズ！」は動くな！' },
    ...seq('T H F C T F HC T', 'C'),
    { p: 'fin', sec: 'end', guide: 'フィーバー！' }
  ];
  const hard = {
    bpm: 128,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 朝までフィーバー' },
      { p: 'rest', sec: 'I', guide: 'ハイ=次の拍／クラップ=2回／ターン=2拍あと／フリーズ=止まる' },
      ...seq('HH C T F HC C', 'A'),
      ...seq('F T HC F CC T', 'B', 'クラップ連打とフリーズ！'),
      ...seq('HC F T CC F HC T CC HH C', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'フィーバー！' }
    ]
  };
  const lessons = [
    { p: 'H', title: 'ハイ！', hint: '「ハイ！」→ 次の拍でポーズ' },
    { p: 'C', title: 'クラップ', hint: '「クラップ！」→ 拍と裏で2回' },
    { p: 'T', title: 'ターン', hint: '「ターン！」→ 2拍あとにポーズ' },
    { p: 'F', title: 'フリーズ', hint: '「フリーズ！」→ 押さずにガマン' }
  ];

  const PROG = { A: ['Am9', 'Am9', 'D9', 'D9'], B: ['Fmaj7', 'E7#9', 'Am9', 'D9'], C: ['Dm9', 'G9', 'Cmaj7', 'E7#9'], P: ['Am9', 'D9'], I: ['E7#9'], count: ['Am9'], end: ['Am9'] };
  const STRINGS_MEL = { C: ['E5 - - - G5 - A5 -', 'B5 - - - A5 - G5 -', 'E5 - - - D5 - C5 -', 'B4 - - - . . . .'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec, i = info.secBar;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'kick2', gain: 0.4 }));
    if (sec === 'end') return RG.Band.ending('Am9');
    // フリーズの小節はバンドも止まる（ハイハットだけ）
    if (info.p === 'F') return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.12, pan: 0.2 }));
    return RG.Band.bar(info, chart, {
      style: 'disco', chord: info.chord, drums: 0.85, comp: 0.75, bass: 0.9, clearCues: true, pad: sec === 'B' || sec === 'C' ? 0.3 : 0.15,
      mel: STRINGS_MEL[sec] ? STRINGS_MEL[sec][i % 4] : null, melInst: 'lead', melGain: 0.3, melPan: -0.2
    });
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat), ch = RG.Band.chord((bar && bar.chord) || 'Am9');
    const base = tg.type === 'clap' ? [{ id: 'clap', gain: 0.9 }] : tg.type === 'turn' ? [{ id: 'whoosh', gain: 0.6 }, { id: 'snap', gain: 0.8 }] : [{ id: 'snap', gain: 0.9 }];
    base.push({ id: `ep:${up(ch.notes[(tg.k + 1) % ch.notes.length])}:0.5`, gain: 0.4 });
    if (kind === 'perfect') base.push({ id: 'sparkle', gain: 0.35 });
    return base;
  }
  const up = n => n.replace(/(-?\d)$/, d => String(+d + 1));
  function preload() {
    const ids = ['clap', 'snap', 'whoosh', 'sparkle', 'miss'];
    Object.values(PROG).flat().forEach(c => RG.Band.chord(c).notes.forEach(n => ids.push(`ep:${up(n)}:0.5`)));
    return ids;
  }

  // ---------------- 描画 ----------------
  const DANCERS = [{ x: 62, c: '#ff3d8b' }, { x: 140, c: '#1fc7b6' }, { x: 218, c: '#ffc23a' }, { x: 300, c: '#ff7a1a', you: true }];

  function dancer(g, x, y, pose, k, color, beat, opt = {}) {
    g.save(); g.translate(x, y);
    const bounce = pose === 'freeze' ? 0 : U.hop(beat) * 5;
    g.translate(0, -bounce);
    if (pose === 'turn') g.scale(Math.cos(k * Math.PI * 2), 1);
    if (pose === 'stumble') g.rotate(0.35 * Math.sin(k * 10) * (1 - k));
    const ink = '#1a0b26';
    // 脚（ベルボトム）
    const step = pose === 'idle' ? Math.sin(beat * Math.PI) * 6 : 0;
    g.fillStyle = color;
    g.beginPath(); g.moveTo(-12, 10); g.lineTo(-4, 10); g.lineTo(-2 + step, 52); g.lineTo(-20 + step, 52); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(4, 10); g.lineTo(12, 10); g.lineTo(20 - step, 52); g.lineTo(2 - step, 52); g.closePath(); g.fill();
    D.ell(g, -11 + step, 54, 9, 4, ink); D.ell(g, 11 - step, 54, 9, 4, ink);
    // 体
    D.rrect(g, -14, -26, 28, 40, 10, color, ink, 2.5);
    g.beginPath(); g.moveTo(-6, -26); g.lineTo(0, -12); g.lineTo(6, -26); g.fillStyle = '#fff'; g.fill(); // 襟
    // 腕
    const arm = (sx, ang, len = 26) => { g.save(); g.translate(sx * 12, -20); g.rotate(ang); D.line(g, 0, 0, 0, len, ink, 8); D.line(g, 0, 0, 0, len, color, 5); D.circ(g, 0, len + 2, 5, '#f2c18d', ink, 2); g.restore(); };
    if (pose === 'hai') { arm(1, -2.6 - 0.2 * k, 30); arm(-1, 0.6); }
    else if (pose === 'clap') { arm(1, 1.1 + 0.3 * k, 22); arm(-1, -1.1 - 0.3 * k, 22); if (k > 0.5) D.star(g, 0, -4, 8, 3, 4, 0, '#ffe066'); }
    else if (pose === 'turn') { arm(1, -1.6); arm(-1, 1.6); }
    else if (pose === 'freeze') { arm(1, -2.2, 30); arm(-1, 0.9); }
    else if (pose === 'stumble') { arm(1, -2.8); arm(-1, 2.8); }
    else { const s = Math.sin(beat * Math.PI) * 0.5; arm(1, 0.4 + s); arm(-1, -0.4 + s); }
    // 頭とアフロ
    for (let i = 0; i < 9; i++) D.circ(g, Math.cos(i / 9 * D.TAU) * 17, -48 + Math.sin(i / 9 * D.TAU) * 11, 11, opt.afro || '#2a1420');
    D.circ(g, 0, -40, 14, '#f2c18d', ink, 2.5);
    if (pose === 'stumble') D.eyes(g, 0, -42, 6, 3, 'dizzy');
    else if (opt.cool) D.shades(g, 0, -42, 6, 4.5);
    else D.eyes(g, 0, -42, 6, 3, pose === 'freeze' ? 'closed' : k > 0 && pose !== 'idle' ? 'happy' : 'normal');
    D.mouth(g, 0, -33, 4, pose === 'stumble' ? 'o' : 'smile');
    g.restore();
    if (opt.you) { D.star(g, x, y - 74 - bounce, 9, 4, 5, 0, '#ffe066', ink, 1.5); D.text(g, 'YOU', x, y - 88 - bounce, 11, '#ffe066', ink); } // 回転しても読めるように外で描く
    if (pose === 'freeze' && opt.ice) { g.save(); g.globalAlpha = 0.35; D.rrect(g, x - 26, y - 72, 52, 132, 10, '#bfe8ff'); g.restore(); }
  }

  function boss(g, x, y, act, k, beat) {
    g.save(); g.translate(x, y - U.hop(beat) * 3);
    const ink = '#1a0b26';
    D.rrect(g, -22, -10, 44, 52, 12, '#ffc23a', ink, 3);
    D.line(g, -8, -6, -8, 40, '#e8a020', 3); D.line(g, 8, -6, 8, 40, '#e8a020', 3);
    const arm = (sx, ang) => { g.save(); g.translate(sx * 20, -4); g.rotate(ang); D.line(g, 0, 0, 0, 30, ink, 10); D.line(g, 0, 0, 0, 30, '#ffc23a', 7); D.circ(g, 0, 32, 6, '#c98a5a', ink, 2); g.restore(); };
    if (act === 'hai') { arm(1, -2.7); arm(-1, 0.5); }
    else if (act === 'clap') { arm(1, 1.2 + 0.2 * Math.sin(k * 20)); arm(-1, -1.2 - 0.2 * Math.sin(k * 20)); }
    else if (act === 'turn') { arm(1, -1.6 + k * 6); arm(-1, 1.6 + k * 6); }
    else if (act === 'freeze') { arm(1, -0.9); arm(-1, 0.9); }
    else if (act === 'angry') { arm(1, -2.2 + Math.sin(k * 30) * 0.3); arm(-1, 0.4); }
    else { arm(1, 0.3); arm(-1, -0.3); }
    for (let i = 0; i < 12; i++) D.circ(g, Math.cos(i / 12 * D.TAU) * 30, -42 + Math.sin(i / 12 * D.TAU) * 20, 16, '#1d1420');
    D.circ(g, 0, -30, 20, '#c98a5a', ink, 3);
    D.shades(g, 0, -34, 9, 6, '#ff3d8b');
    g.beginPath(); g.moveTo(-12, -22); g.quadraticCurveTo(0, -28, 12, -22); g.quadraticCurveTo(0, -18, -12, -22); g.fillStyle = ink; g.fill(); // ひげ
    D.mouth(g, 0, -14, 6, act === 'angry' ? 'open' : act && act !== 'idle' ? 'open' : 'smile');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, tapType: null, lastMiss: -99, lastExtra: -99, results: new Map() };
    const typeAt = beat => { let t = null; for (const tg of chart.inputs) { if (tg.beat > beat + 0.3) break; if (Math.abs(tg.beat - beat) < 0.3) t = tg.type; } return t; };
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at;
        if (r && r.demo) { st.lastTap = tg.beat; st.tapType = tg.type; }
      },
      onTap(vbeat, r) {
        st.lastTap = vbeat;
        st.tapType = r && r.target ? r.target.type : typeAt(vbeat) || 'hai';
        if (r && r.kind === 'extra') st.lastExtra = vbeat;
      },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 背景：ディスコの床とミラーボール
        g.fillStyle = '#16081f'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        const bar = Math.floor(beat / 4);
        for (let r = 0; r < 5; r++) for (let c = -2; c < 9; c++) {
          const y0 = 372 + r * 34, w = 46 + r * 10, x0 = 180 + (c - 3.5) * w;
          const on = (r + c + bar) % 3 === 0;
          g.fillStyle = on ? ['#5a1f63', '#1f5a63', '#63421f'][(bar + r) % 3] : '#241030';
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0); g.lineTo(x0 + w + 5, y0 + 34); g.lineTo(x0 - 5, y0 + 34); g.fill();
        }
        // ライトの帯（ゆっくり回るだけ。強い点滅はしない）
        g.save(); g.globalAlpha = 0.12;
        for (let k = 0; k < 4; k++) { const a = Math.sin(beat * 0.25 + k * 1.6) * 0.6; g.save(); g.translate(180, 60); g.rotate(a); g.beginPath(); g.moveTo(-6, 0); g.lineTo(-60, 480); g.lineTo(60, 480); g.lineTo(6, 0); g.fillStyle = ['#ff3d8b', '#1fc7b6', '#ffc23a', '#ff7a1a'][k]; g.fill(); g.restore(); }
        g.restore();
        D.line(g, 180, view.y0, 180, 44, '#777', 2);
        D.circ(g, 180, 60, 16, '#c8c8d8', '#6a6a80', 2);
        for (let k = 0; k < 6; k++) D.rrect(g, 172 + Math.cos(beat * 0.8 + k) * 8, 54 + (k % 3) * 5, 5, 4, 1, k % 2 ? '#fff' : '#9aa0c0');
        // ステージ
        D.rrect(g, 110, 214, 140, 18, 6, '#3a1f55', '#0f0618', 3);
        g.fillStyle = '#2b1640'; g.fillRect(118, 232, 124, 30);

        // 先生の動き：直近の合図
        let act = 'idle', ak = 0, freezeOn = false;
        for (const c of chart.cues) {
          if (c.beat > beat + 0.01) break;
          const d = beat - c.beat;
          if (['hai', 'clap', 'turn', 'freeze'].includes(c.type) && d < 1) { act = c.type; ak = d; }
          if (c.type === 'freeze' && d < 3.8) freezeOn = true;
        }
        if (beat - st.lastExtra < 1.2) act = 'angry';
        if (fin !== null) act = 'hai';
        boss(g, 180, 192, act, ak, beat);

        // バックダンサー（自動でうまく踊る）
        let lastTg = null;
        for (const tg of chart.inputs) { if (tg.beat > beat + 0.05) break; lastTg = tg; }
        const autoPose = () => {
          if (fin !== null) return ['hai', U.prog(fin, 0, 0.3)];
          if (freezeOn) return ['freeze', 1];
          if (lastTg && beat - lastTg.beat < 0.45) return [lastTg.type, 1 - (beat - lastTg.beat) / 0.45];
          // ターンの途中は回る
          for (const tg of chart.inputs) { if (tg.beat > beat + 2.1) break; if (tg.type === 'turn' && beat > tg.beat - 1.6 && beat < tg.beat) return ['turn', (beat - (tg.beat - 1.6)) / 1.6]; }
          return ['idle', 0];
        };
        const [ap, ak2] = autoPose();
        DANCERS.forEach((d, i) => {
          if (d.you) return;
          dancer(g, d.x, 410, ap, ak2, d.c, beat + i * 0.02, { ice: true, cool: combo >= 10 });
        });
        // プレイヤー
        let pp = 'idle', pk = 0;
        const dTap = beat - st.lastTap, dMiss = beat - st.lastMiss;
        if (fin !== null) { pp = 'hai'; pk = 1; }
        else if (dMiss >= 0 && dMiss < 0.8) { pp = 'stumble'; pk = dMiss / 0.8; }
        else if (dTap >= 0 && dTap < 0.45) { pp = st.tapType || 'hai'; pk = 1 - dTap / 0.45; if (pp === 'turn') pp = 'hai'; }
        else if (freezeOn) { pp = 'freeze'; pk = 1; }
        else if (ap === 'turn') { pp = 'turn'; pk = ak2; }
        dancer(g, DANCERS[3].x, 410, pp, pk, DANCERS[3].c, beat, { you: true, ice: freezeOn && pp === 'freeze', cool: combo >= 10 });
        if (freezeOn && beat - st.lastExtra < 1.2) D.text(g, '!?', DANCERS[3].x + 26, 330, 22, '#ffe066', '#1a0b26');
        if (freezeOn && ak < 0.6 && act === 'freeze') D.text(g, 'カチーン', 180, 300, 20, '#bfe8ff', '#1a0b26');

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 120); g.scale(s, s); g.rotate(-0.06);
          D.text(g, 'フィーバー！', 0, 0, 36, '#ffc23a', '#1a0b26');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#16081f'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    for (let c = 0; c < 5; c++) { g.fillStyle = c % 2 ? '#5a1f63' : '#1f5a63'; g.fillRect(c * 20, 80, 20, 20); }
    g.save(); g.translate(50, 60); g.scale(0.62, 0.62); dancer(g, 0, 0, Math.sin(t * 3) > 0 ? 'hai' : 'idle', 1, '#ff7a1a', t * 2, { cool: true }); g.restore();
    D.circ(g, 50, 10, 7, '#c8c8d8');
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.disco = {
    id: 'disco', title: 'ディスコ・フリーズ', color: '#ff3d8b', group: 'dance', level: 3,
    howto: '先生の声「ハイ！」→次の拍、「クラップ！」→2回、「ターン！」→2拍あと、「フリーズ！」→止まる',
    bpm: 118, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      hai: { id: 'voice:boss:ハイ！', gain: 1.5, bus: 'cue', say: 'ハイ！', who: 'boss', len: 0.8 },
      clap: { id: 'voice:boss:クラップ！', gain: 1.5, bus: 'cue', say: 'クラップ！', who: 'boss', len: 0.9 },
      turn: { id: 'voice:boss:ターン！', gain: 1.5, bus: 'cue', say: 'ターン！', who: 'boss', len: 0.9 },
      freeze: { id: 'voice:boss:フリーズ！', gain: 1.5, bus: 'cue', say: 'フリーズ！', who: 'boss', len: 1.2 },
      fin: [{ id: 'voice:crowd:フィーバー！', gain: 1.2, bus: 'voice', say: 'フィーバー！', who: 'crowd' }, { id: 'cheer', gain: 0.8 }]
    },
    missSound: 'miss',
    anchors: { boss: { x: 180, y: 140 }, crowd: { x: 180, y: 330 }, you: { x: 300, y: 330 } },
    quips: {
      miss: [{ id: 'voice:boss:オイオイ？', say: 'オイオイ？', who: 'boss' }, { id: 'voice:boss:ズレテルゾ', say: 'ズレてるぞ', who: 'boss' }],
      extra: [{ id: 'voice:boss:ウゴクナ！', say: 'ウゴクナ！', who: 'boss' }, { id: 'voice:boss:フリーズダッテ！', say: 'フリーズだって！', who: 'boss' }],
      combo: [{ id: 'voice:crowd:フゥー！', say: 'フゥー！', who: 'crowd' }, { id: 'voice:boss:イイネ〜！', say: 'イイネ〜！', who: 'boss' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
