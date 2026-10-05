/*
 * ミニゲーム⑩「パイ投げ道場」（よけ系・お笑い）
 *   ピエロ師範がパイを投げる。顔に当たる瞬間にタップで「ひょいっ」とかわす。
 *     「ソーレ！」       → 2拍あとに届く
 *     「ホイッ」         → 1拍あと（速い）
 *     「ソレソレソレ！」 → 2拍あとから3連符で3つ（タタタ）
 *     「ブーメラン！」   → 2拍あとにかわしたら、後ろから戻ってきて3拍目の裏（2拍目から1拍半あと）にもう一度
 *     「フェイント〜」   → 投げない！ かわしたら笑われる（余分な入力・ハード）
 */
(function () {
  const { U, D } = RG;
  const T3 = 2 / 3;
  const patterns = {
    N: { len: 4, cues: [{ b: 0, type: 'throw', for: 0 }], inputs: [{ b: 2, type: 'pie' }] },
    QQ: { len: 4, cues: [{ b: 0, type: 'quick', for: 0 }, { b: 2, type: 'quick', for: 1 }], inputs: [{ b: 1, type: 'pie' }, { b: 3, type: 'pie' }] },
    T: { len: 4, cues: [{ b: 0, type: 'triple', for: 0 }], inputs: [2, 2 + T3, 2 + 2 * T3].map(b => ({ b, type: 'tri' })) },
    B: { len: 4, cues: [{ b: 0, type: 'boomerang', for: 0 }], inputs: [{ b: 2, type: 'boom' }, { b: 3.5, type: 'boomBack' }] },
    F: { len: 4, cues: [{ b: 0, type: 'fake' }], inputs: [], activeAlways: true, active: [0.4, 3.8] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'パイ投げ道場、入門！' },
    { p: 'rest', sec: 'I', guide: '「ソーレ！」の2拍あと、顔に届く瞬間にかわす' },
    ...seq('N N N N N N', 'A'),
    { p: 'rest', sec: 'I', guide: '「ホイッ」は速い！ 1拍あと' },
    ...seq('QQ N QQ N QQ QQ', 'B'),
    { p: 'rest', sec: 'I', guide: '「ソレソレソレ」は3つ、「ブーメラン」は戻ってくる！' },
    ...seq('T N B QQ T B N T', 'C'),
    { p: 'fin', sec: 'end', guide: '免許皆伝！' }
  ];
  const hard = {
    bpm: 116,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 師範、本気です' },
      { p: 'rest', sec: 'I', guide: '「フェイント〜」はかわすな！' },
      ...seq('N QQ T N B QQ', 'A'),
      ...seq('F T B QQ F T', 'B', 'フェイントにだまされるな'),
      ...seq('B T F QQ T B F T', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '免許皆伝！' }
    ]
  };
  const lessons = [
    { p: 'N', title: 'ソーレ！', hint: '「ソーレ！」→ 2拍あとにかわす' },
    { p: 'QQ', title: 'ホイッ', hint: '「ホイッ」→ 1拍あと（2回）' },
    { p: 'T', title: 'ソレソレソレ', hint: '2拍あとから「タ・タ・タ」と3つ' },
    { p: 'B', title: 'ブーメラン', hint: 'かわして、1拍半あとにもう一度' },
    { p: 'F', title: 'フェイント（ハード用）', hint: '「フェイント〜」→ かわさない' }
  ];

  const PROG = { A: ['C6', 'A7', 'Dm7', 'G7'], B: ['F6', 'F#dim', 'C6', 'A7'], C: ['Dm7', 'G7', 'Em7', 'A7'], P: ['C6', 'G7'], I: ['G7'], count: ['C6'], end: ['C6'] };
  const MEL = { A: ['E5 - G5 - A5 - G5 -', 'E5 - C#5 - D5 - E5 -', 'F5 - - - D5 - A4 -', 'B4 - D5 - G5 - - -'], C: ['A5 - F5 - D5 - F5 -', 'G5 - - - B4 - D5 -', 'G5 - E5 - B4 - E5 -', 'C#5 - - - A4 - - -'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.25 }));
    if (sec === 'end') return RG.Band.ending('C6');
    if (info.p === 'F') return [{ b: 0, id: 'kick2', gain: 0.4 }, { b: 2, id: 'hh2', gain: 0.15 }];
    return RG.Band.bar(info, chart, { style: 'shuffle', chord: info.chord, drums: 0.75, comp: 0.85, bass: 0.85, clearCues: true, pad: 0, mel: MEL[sec] ? MEL[sec][info.secBar % 4] : null, melInst: 'organ', melGain: 0.4, melPan: -0.25 });
  }
  function hitSounds(tg, kind) {
    const s = [{ id: 'whoosh', gain: 0.8 }, { id: 'snap', gain: 0.5 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.3 });
    return s;
  }
  function preload() { return ['whoosh', 'snap', 'sparkle', 'splat']; }

  // ---------------- 描画 ----------------
  const HAND = { x: 92, y: 300 }, FACE = { x: 284, y: 318 };
  const arc = (a, b, u, h) => ({ x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u) - Math.sin(Math.PI * U.clamp(u, 0, 1)) * h });
  function clown(g, x, y, beat, act, k) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - U.hop(beat) * 3);
    D.rrect(g, -26, 0, 52, 70, 14, '#f4f4f4', ink, 3); // 道着
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, 30); g.lineTo(10, 0); g.lineWidth = 3; g.strokeStyle = ink; g.stroke();
    D.rrect(g, -26, 40, 52, 8, 3, '#1a0b26');
    // 虹色アフロ
    ['#ff3d8b', '#ffc23a', '#1fc7b6', '#7a5cff'].forEach((c, i) => { for (let j = 0; j < 3; j++) D.circ(g, -30 + i * 20, -40 + (j - 1) * 12 + (i % 2) * 4, 14, c); });
    D.circ(g, 0, -26, 24, '#ffffff', ink, 3);
    D.circ(g, 0, -20, 7, '#ff2a2a', ink, 2); // 赤い鼻
    if (act === 'laugh') { D.eyes(g, 0, -32, 10, 4, 'happy'); D.ell(g, 0, -6, 10, 6 + Math.abs(Math.sin(k * 30)) * 3, '#7a2a3a', ink, 2); }
    else { D.eyes(g, 0, -32, 10, 4, act === 'shock' ? 'wide' : 'normal'); D.mouth(g, 0, -8, 9, act === 'shock' ? 'o' : 'smile'); }
    // 投げる腕
    const ang = act === 'wind' ? -2.4 + k * 0.3 : act === 'throw' ? 0.3 + (1 - k) * -2.6 : act === 'fake' ? -2.4 + Math.sin(k * 25) * 0.25 : -0.4;
    g.save(); g.translate(22, 10); g.rotate(ang); D.line(g, 0, 0, 0, 34, ink, 11); D.line(g, 0, 0, 0, 34, '#f4f4f4', 8); D.circ(g, 0, 36, 7, '#ffffff', ink, 2); g.restore();
    g.save(); g.translate(-22, 10); g.rotate(0.4); D.line(g, 0, 0, 0, 30, ink, 11); D.line(g, 0, 0, 0, 30, '#f4f4f4', 8); g.restore();
    g.restore();
  }
  function ninja(g, x, y, beat, duck, creamed, cool) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y + duck * 34); g.scale(1, 1 - duck * 0.12);
    D.rrect(g, -22, 0, 44, 60, 14, '#2b2b3a', ink, 3);
    D.circ(g, 0, -24, 24, '#f0b060', ink, 3);
    g.beginPath(); g.moveTo(-20, -36); g.lineTo(-14, -58); g.lineTo(-4, -44); g.moveTo(20, -36); g.lineTo(14, -58); g.lineTo(4, -44); g.fillStyle = '#f0b060'; g.fill(); g.stroke();
    D.rrect(g, -26, -40, 52, 9, 4, '#ff3d6e', ink, 2); // はちまき
    g.beginPath(); g.moveTo(24, -38); g.lineTo(42, -30 + Math.sin(beat * 5) * 4); g.lineTo(40, -24); g.closePath(); g.fillStyle = '#ff3d6e'; g.fill();
    if (cool && !creamed) D.shades(g, -2, -24, 8, 5.5); else D.eyes(g, -2, -24, 8, 3.5, duck > 0.3 ? 'closed' : 'normal', -1);
    D.mouth(g, -2, -12, 4, duck > 0.3 ? 'wavy' : 'smile');
    if (creamed > 0) {
      g.globalAlpha = creamed;
      g.beginPath(); g.ellipse(-2, -22, 26, 22, 0, 0, D.TAU); g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#e8d8b0'; g.stroke();
      for (let k = 0; k < 4; k++) D.ell(g, -18 + k * 12, 0 + (k % 2) * 6, 4, 8, '#fffaf0');
      D.circ(g, 4, -36, 5, '#ff4a6a'); // いちご
      g.globalAlpha = 1;
    }
    g.restore();
  }
  function pie(g, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1.4, 1.4);
    D.ell(g, 0, 4, 18, 7, '#d9a36a', '#7a4f26', 2);
    D.ell(g, 0, 0, 16, 7, '#fffaf0', '#e8d8b0', 1.5);
    D.circ(g, 0, -4, 3.5, '#ff4a6a');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastExtra: -99, results: new Map() };
    let cache = null, n = -1;
    const throwCues = () => { if (n !== chart.cues.length) { cache = chart.cues.filter(c => c.target); n = chart.cues.length; } return cache; };
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at;
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat, r) { st.lastTap = vbeat; if (r && r.kind === 'extra') st.lastExtra = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 道場
        g.fillStyle = '#c9a26a'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#b58a52'; for (let k = -2; k < 12; k++) g.fillRect(k * 40, view.y0, 4, 420 - view.y0);
        g.fillStyle = '#8fb06a'; g.fillRect(view.x0, 420, view.x1 - view.x0, view.y1 - 420);
        g.strokeStyle = '#6e8f4a'; g.lineWidth = 2; for (let k = -2; k < 6; k++) { g.strokeRect(k * 90, 420, 90, 60); g.strokeRect(k * 90 + 45, 480, 90, 60); }
        D.rrect(g, 128, 60, 104, 150, 6, '#fffaf0', '#7a4f26', 4); // 掛け軸
        D.text(g, 'パ', 180, 100, 34, '#1a0b26'); D.text(g, 'イ', 180, 140, 34, '#1a0b26'); D.text(g, '道', 180, 180, 34, '#c2185b');

        // 師範の動き
        let act = 'idle', ak = 0;
        for (const c of chart.cues) {
          if (c.beat > beat + 0.5) break;
          const d = beat - c.beat;
          if (c.type === 'fake' && d >= -0.4 && d < 2) { act = 'fake'; ak = d; }
          else if (c.target && d >= -0.4 && d < 0) { act = 'wind'; ak = (d + 0.4) / 0.4; }
          else if (c.target && d >= 0 && d < 0.4) { act = 'throw'; ak = d / 0.4; }
        }
        const dm = beat - st.lastMiss, de = beat - st.lastExtra;
        if ((dm >= 0 && dm < 1.4) || (de >= 0 && de < 1.4)) { act = 'laugh'; ak = Math.min(dm < 0 ? 9 : dm, de < 0 ? 9 : de); }
        if (fin !== null) act = 'shock';
        clown(g, 60, 300, beat, act, ak);
        if (act === 'fake' && ak > 0.2 && ak < 1.6) D.text(g, 'なんちゃって', 92, 236, 15, '#c2185b', '#fff');

        // パイ
        for (const c of throwCues()) {
          if (c.beat > beat + 0.01) break;
          c.inst.targets.forEach(tg => {
            const res = st.results.get(tg);
            const t0 = tg.type === 'boomBack' ? tg.beat - 1.5 : tg.type === 'tri' ? tg.beat - 2 : c.beat;
            if (beat < t0) return;
            if (tg.type === 'boomBack') {
              // かわしたパイが右へ抜けて、戻ってくる
              const prev = c.inst.targets[0], pr = st.results.get(prev);
              if (!pr || pr.kind === 'miss') return;
              if (res) { if (res.kind !== 'miss') { const e = beat - res.at; if (e < 0.6) pie(g, U.lerp(FACE.x, -30, e / 0.6), FACE.y - 30 * Math.sin(Math.PI * e / 0.6), e * 8); } return; }
              const u = (beat - (prev.beat)) / 1.5;
              const p = u < 0.5 ? arc(FACE, { x: 390, y: 260 }, u * 2, 40) : arc({ x: 390, y: 260 }, FACE, (u - 0.5) * 2, -30);
              pie(g, p.x, p.y, -beat * 8);
              return;
            }
            if (res) {
              const e = beat - res.at;
              if (res.kind !== 'miss') { if (tg.type !== 'boom' && e < 0.5) pie(g, U.lerp(FACE.x, 400, e / 0.5), FACE.y - 10 - 40 * e, e * 6); }
              return;
            }
            const u = (beat - t0) / (tg.beat - t0);
            const p = arc(HAND, FACE, Math.min(u, 1.05), tg.type === 'pie' && tg.beat - t0 < 1.5 ? 30 : 70);
            pie(g, p.x, p.y, Math.sin(beat * 3) * 0.2);
          });
        }
        // 忍者ネコ（かわす）
        const dt = beat - st.lastTap;
        const duck = dt >= 0 && dt < 0.4 ? Math.sin(Math.PI * dt / 0.4) : 0;
        const creamed = dm >= 0 && dm < 1.5 ? 1 - U.prog(dm, 1.1, 1.5) : 0;
        ninja(g, FACE.x + 4, FACE.y + 30, beat, duck, creamed, combo >= 10);
        if (creamed > 0.5) D.text(g, 'ベチャ', FACE.x - 30, FACE.y - 60, 18, '#fffaf0', '#7a4f26');
        if (duck > 0.6 && dt < 0.2) D.text(g, 'ひょいっ', FACE.x - 10, FACE.y - 70, 15, '#1a0b26', '#fff');

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 250); g.scale(s, s); g.rotate(-0.06);
          D.text(g, '免許皆伝！', 0, 0, 36, '#c2185b', '#fffaf0');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#c9a26a'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.fillStyle = '#8fb06a'; g.fillRect(0, 80, 100, 20);
    g.save(); g.translate(68, 60); g.scale(0.55, 0.55); ninja(g, 0, 0, t * 2, Math.max(0, Math.sin(t * 4)), 0, true); g.restore();
    pie(g, 20 + ((t * 30) % 40), 40, t * 3);
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.pie = {
    id: 'pie', title: 'パイ投げ道場', color: '#c2185b', group: 'fun', level: 3,
    howto: 'パイが顔に届く瞬間にかわす。「ソーレ！」→2拍あと、「ホイッ」→1拍あと、「ソレソレソレ」→3連',
    bpm: 104, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      throw: { id: 'voice:clown:ソーレ！', gain: 1.1, say: 'ソーレ！', who: 'clown', len: 0.9 },
      quick: { id: 'voice:clown:ホイッ', gain: 1.4, say: 'ホイッ', who: 'clown', len: 0.6 },
      triple: { id: 'voice:clown:ソレソレソレ！', gain: 1.1, say: 'ソレソレソレ！', who: 'clown', len: 1.2 },
      boomerang: { id: 'voice:clown:ブーメラン！', gain: 1.1, say: 'ブーメラン！', who: 'clown', len: 1.2 },
      fake: { id: 'voice:clown:フェイント〜', gain: 1.1, say: 'フェイント〜', who: 'clown', len: 1.4 },
      fin: [{ id: 'voice:clown:オミゴト！', gain: 1.2, bus: 'voice', say: 'お見事！', who: 'clown' }, { id: 'cheer', gain: 0.7 }]
    },
    missSound: 'splat',
    anchors: { clown: { x: 76, y: 240 }, you: { x: 280, y: 250 } },
    quips: {
      miss: [{ id: 'voice:clown:ギャハハ！', say: 'ギャハハ！', who: 'clown' }, { id: 'voice:kid:ブヘッ', say: 'ブヘッ', who: 'you' }, { id: 'voice:clown:アマイ！', say: '甘い！', who: 'clown' }],
      extra: [{ id: 'voice:clown:ダマサレタ〜', say: 'だまされた〜', who: 'clown' }],
      combo: [{ id: 'voice:clown:ヤルナ！', say: 'やるな！', who: 'clown' }, { id: 'voice:kid:ヨユウ！', say: 'よゆう！', who: 'you' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
