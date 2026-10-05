/*
 * ミニゲーム③「森のエコー楽団」
 *   1小節目：うさぎ先生がお手本を演奏（聴く時間。拍の刻みは低い「コッ」）
 *   2小節目：同じ位置でタップして返す（返す時間。拍の刻みは高い「チッ」）
 *   聴く時間のタップは採点しない（減点もしない）
 */
(function () {
  const { U, D, Music: M } = RG;
  const BPM = 96;

  function phrase(pos) {
    return {
      len: 8, active: [4, 8], pos,
      cues: [
        ...pos.map(b => ({ b, type: 'pon', who: 't' })),
        ...[0, 1, 2, 3].map(b => ({ b, type: 'tickL' })),
        ...[4, 5, 6, 7].map(b => ({ b, type: 'tickR' }))
      ].sort((a, b) => a.b - b.b),
      inputs: pos.map(b => ({ b: b + 4, type: 'echo' }))
    };
  }
  const patterns = {
    p02: phrase([0, 2]),            // 1拍目と3拍目
    p012: phrase([0, 1, 2]),        // 1・2・3拍目
    p0123: phrase([0, 1, 2, 3]),
    p013: phrase([0, 1, 3]),        // 3拍目が休み
    p023: phrase([0, 2, 3]),
    p03: phrase([0, 3]),
    p0153: phrase([0, 1.5, 3]),     // 1拍目、2拍目の裏、4拍目
    p0052: phrase([0, 0.5, 2]),
    p01253: phrase([0, 1, 2.5, 3]),
    p05153: phrase([0.5, 1.5, 3]),   // 裏から始まる（ハード）
    p00515: phrase([0, 0.5, 1, 1.5]),
    p02535: phrase([0, 2.5, 3.5]),
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };

  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: '森のエコー楽団、はじまるよ' },
    { p: 'rest', sec: 'I', guide: '先生のリズムを聴いて、同じように返そう' },
    ...seq('p02 p012 p02 p0123', 'A', '「コッ」の間は聴く、「チッ」の間に返す'),
    ...seq('p013 p023 p03', 'B', '休みが入るよ。休みは押さない！'),
    ...seq('p0153 p0052 p01253 p0153', 'C', '裏拍（拍と拍のあいだ）が入るよ'),
    { p: 'fin', sec: 'end', guide: '演奏おしまい！' }
  ];
  const hard = {
    bpm: 106,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 裏拍だらけ' },
      { p: 'rest', sec: 'I', guide: '「コッ」で聴いて、「チッ」で返す' },
      ...seq('p0153 p0052 p05153 p01253', 'A'),
      ...seq('p00515 p02535 p0153 p05153', 'B', '細かくなるよ'),
      ...seq('p01253 p00515 p02535 p05153', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '演奏おしまい！' }
    ]
  };

  const lessons = [
    { p: 'p02', title: '同じ間隔', hint: 'ポン・・ポン → 1拍目と3拍目' },
    { p: 'p013', title: '休みのあるリズム', hint: 'ポン ポン ・ ポン → 3拍目は休み' },
    { p: 'p0153', title: '裏拍のリズム', hint: 'ポン・・ン ポン・ポン → 2拍目の「裏」' },
    { p: 'p05153', title: '裏から始まる（ハード用）', hint: '・ン ・ン ・ポン → 1拍目の裏から' }
  ];

  const PROG = { A: ['G', 'G', 'Em', 'Em', 'C', 'C', 'D', 'D'], B: ['C', 'C', 'G', 'G', 'Am', 'Am', 'D', 'D'], C: ['G', 'G', 'Em', 'Em', 'C', 'C', 'D', 'D'], P: ['G', 'G', 'C', 'C'], I: ['D'], count: ['G'], end: ['G'] };
  const FL = { G: 'D5', Em: 'B4', C: 'E5', D: 'F#5', Am: 'C5' };
  const up = (n, k = 1) => n.replace(/(-?\d)$/, d => String(parseInt(d, 10) + k));

  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const spb = chart.spb, ch = info.chord, sec = info.sec;
    const ev = [];
    if (sec === 'count') return ev;
    if (sec === 'end') {
      M.strum('G', 0, 'guitar', 0.6, 0.04, 2.4).forEach(e => ev.push(e));
      ev.push({ b: 0, id: 'bass:G2:2', gain: 1 }, { b: 0, id: 'flute:G5:1.6', gain: 0.8 }, { b: 0, id: 'kick', gain: 0.9 });
      return ev;
    }
    M.strum(ch, 0, 'guitar', 0.45, 0.04, 1.6).forEach(e => ev.push(e));
    M.strum(ch, 2, 'guitar', 0.3, 0.04, 1.2).forEach(e => ev.push(e));
    ev.push({ b: 0, id: `bass:${M.root(ch, 2)}:1.2`, gain: 0.9 });
    ev.push(...M.rhythm('..o...o...o...o.', 'shaker', 0.5));
    if (sec === 'C') ev.push(...M.rhythm('x.......x.......', 'kick', 0.5));
    // 笛：長くのばす音だけ（リズムの邪魔をしない）。聴く小節だけで鳴らす
    if (info.secBar % 2 === 0 && sec !== 'I') ev.push({ b: 0, id: `flute:${FL[ch] || 'D5'}:${(spb * 3.5).toFixed(1)}`, gain: 0.35 });
    return ev;
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat);
    const ch = M.chord(bar && bar.chord ? bar.chord : 'G');
    const s = [{ id: 'tan', gain: 0.9 }, { id: `marimba:${up(ch[tg.k % 3])}:0.6`, gain: 0.45 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.35 });
    return s;
  }
  function preload() {
    const ids = ['tan', 'pon', 'tickLo', 'tickHi', 'kazoo', 'sparkle', 'chime', 'boom'];
    Object.values(M.CHORDS).forEach(c => c.forEach(n => ids.push(`marimba:${up(n)}:0.6`)));
    return ids;
  }

  // ---------------- 描画 ----------------
  const TEACH = { x: 92, y: 334 }, SQ = { x: 268, y: 334 };
  const FLOWERS = [30, 78, 126, 174, 222, 270, 318, 350].map((x, i) => ({ x, y: 486 + (i % 2) * 14, c: ['#ff8fb1', '#ffd36b', '#b59cff', '#ff9f6b'][i % 4] }));

  function flower(g, x, y, open, color, beat) {
    D.line(g, x, y, x, y + 26, '#3f8a3a', 3);
    D.ell(g, x + 7, y + 16, 7, 3, '#4fa046');
    if (open <= 0) { D.ell(g, x, y - 2, 6, 9, '#7cc46a', '#3f8a3a', 2); return; }
    const s = U.ease.outBack(Math.min(1, open));
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(Math.sin(beat * Math.PI) * 0.06);
    for (let k = 0; k < 5; k++) { g.rotate(D.TAU / 5); D.ell(g, 0, -10, 6, 10, color, 'rgba(0,0,0,.18)', 1.5); }
    D.circ(g, 0, 0, 6, '#fff3a0', '#d0a020', 1.5);
    g.restore();
  }
  function rabbit(g, x, y, beat, strike, mood, point) {
    g.save(); g.translate(x, y - U.hop(beat) * 2);
    // 耳
    const ear = Math.sin(beat * Math.PI) * 0.06;
    [-1, 1].forEach(s => { g.save(); g.translate(s * 13, -52); g.rotate(s * (0.12 + ear)); D.ell(g, 0, -30, 10, 32, '#ffffff', '#6b5a6b', 2.5); D.ell(g, 0, -28, 5, 22, '#ffc4d6'); g.restore(); });
    D.ell(g, 0, 8, 36, 42, '#ffffff', '#6b5a6b', 3);
    D.circ(g, 0, -40, 30, '#ffffff', '#6b5a6b', 3);
    D.eyes(g, 0, -42, 11, 4.5, mood, 1);
    D.blush(g, 0, -32, 18, 5);
    D.mouth(g, 0, -30, 4, mood === 'happy' ? 'smile' : 'smile');
    // 太鼓（丸いハンドドラム）
    const ring = strike > 0 ? strike : 0;
    D.ell(g, 18, 22, 30, 24, '#e9c08a', '#7a4f26', 3);
    D.ell(g, 18, 22, 22, 16, '#f7e2bd');
    if (ring > 0) { g.globalAlpha = ring; D.ell(g, 18, 22, 30 + (1 - ring) * 20, 24 + (1 - ring) * 14, null, '#ffe066', 3); g.globalAlpha = 1; }
    // 手：打つ瞬間に下がる
    const py = 4 + (ring > 0.6 ? 12 : 0);
    if (point) { D.line(g, 24, -6, 62, -16, '#6b5a6b', 11); D.line(g, 24, -6, 62, -16, '#ffffff', 7); D.circ(g, 64, -16, 6, '#ffffff', '#6b5a6b', 2); }
    else D.circ(g, 22, py, 8, '#ffffff', '#6b5a6b', 2.5);
    D.circ(g, -22, 16, 8, '#ffffff', '#6b5a6b', 2.5);
    g.restore();
  }
  function squirrel(g, x, y, beat, hitAmt, mood, tilt, ready, cool) {
    g.save(); g.translate(x, y - U.hop(beat) * 2);
    // しっぽ
    g.beginPath(); g.moveTo(26, 30); g.bezierCurveTo(80, 20, 70, -70, 30, -60); g.bezierCurveTo(60, -40, 50, 10, 20, 10); g.closePath();
    g.fillStyle = '#c47a3c'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#6b3d16'; g.stroke();
    D.ell(g, 0, 10, 32, 40, '#d98c48', '#6b3d16', 3);
    D.ell(g, 0, 18, 20, 28, '#f6d7a8');
    g.save(); g.translate(0, -38); g.rotate(tilt);
    [-1, 1].forEach(s => { D.ell(g, s * 18, -24, 8, 11, '#d98c48', '#6b3d16', 2.5); });
    D.circ(g, 0, 0, 28, '#d98c48', '#6b3d16', 3);
    D.ell(g, 0, 8, 16, 12, '#f6d7a8');
    D.eyes(g, 0, -4, 11, 4.5, mood, -1);
    if (cool && mood !== 'wide') D.shades(g, 0, -4, 11, 6);
    D.circ(g, 0, 6, 3, '#4a2a10');
    D.mouth(g, 0, 13, 4, mood === 'happy' ? 'smile' : mood === 'wide' ? 'o' : 'smile');
    g.restore();
    // 太鼓（四角っぽい胴）
    D.rrect(g, -38, 26, 40, 30, 6, '#7fb2e5', '#2b5f8f', 3);
    D.ell(g, -18, 26, 20, 7, '#eef6ff', '#2b5f8f', 2.5);
    if (hitAmt > 0) { g.globalAlpha = hitAmt; D.ell(g, -18, 26, 20 + (1 - hitAmt) * 22, 7 + (1 - hitAmt) * 10, null, '#ffe066', 3); g.globalAlpha = 1; }
    // ばち
    const a = hitAmt > 0.6 ? 0.9 : ready ? -0.5 : 0.1;
    g.save(); g.translate(-4, 6); g.rotate(a); D.line(g, 0, 0, -26, -18, '#7a4f26', 4); D.circ(g, -27, -19, 4.5, '#f0e0c0', '#7a4f26', 1.5); g.restore();
    D.circ(g, -4, 6, 7, '#d98c48', '#6b3d16', 2.5);
    g.restore();
  }
  function owl(g, x, y, beat, sing) {
    g.save(); g.translate(x, y - sing * 6);
    D.ell(g, 0, 0, 24, 28, '#9a7a5a', '#4a3520', 3);
    D.ell(g, 0, 8, 15, 16, '#e8d6b8');
    D.circ(g, -9, -8, 9, '#fff', '#4a3520', 2); D.circ(g, 9, -8, 9, '#fff', '#4a3520', 2);
    if (sing > 0.3) { D.eyes(g, 0, -8, 9, 4, 'happy'); } else { D.circ(g, -9, -8, 4, '#2a1f2e'); D.circ(g, 9, -8, 4, '#2a1f2e'); }
    g.beginPath(); g.moveTo(-4, -1); g.lineTo(4, -1); g.lineTo(0, 6); g.closePath(); g.fillStyle = '#f0a020'; g.fill();
    g.restore();
  }
  function frog(g, x, y, beat, sing) {
    g.save(); g.translate(x, y - sing * 5);
    D.ell(g, 0, 0, 24, 16, '#6cc46a', '#2f6b2e', 3);
    D.circ(g, -11, -14, 8, '#6cc46a', '#2f6b2e', 2.5); D.circ(g, 11, -14, 8, '#6cc46a', '#2f6b2e', 2.5);
    D.circ(g, -11, -14, 3.5, '#2a1f2e'); D.circ(g, 11, -14, 3.5, '#2a1f2e');
    if (sing > 0.3) D.ell(g, 0, 4, 8, 6 * sing, '#c04a5a'); else D.mouth(g, 0, 2, 7, 'smile');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastHit: -99, lastMiss: -99, blooms: [], hits: new Map() };

    function phase(beat) {
      const inst = chart.instanceAt(beat);
      if (!inst || !chart.game.patterns[inst.p] || !chart.game.patterns[inst.p].pos) return { inst: null, ph: 'idle' };
      return { inst, ph: beat - inst.start < 4 ? 'listen' : 'respond', local: beat - inst.start };
    }

    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.hits.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at;
        else st.lastHit = at;
        if (r && r.demo) st.lastTap = tg.beat;
        // 1フレーズすべて成功 → 花が開く
        const inst = tg.inst;
        if (!inst.demo && inst.targets.every(x => x.judged) && inst.targets.every(x => x.judged === 'perfect' || x.judged === 'good')) {
          st.blooms.push(at);
          session.playNow('chime', 0.6);
        }
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const P = phase(beat);
        // 背景
        const grd = g.createLinearGradient(0, view.y0, 0, view.y1);
        grd.addColorStop(0, '#e3f6d2'); grd.addColorStop(0.7, '#b9e2a0'); grd.addColorStop(1, '#8fcf7a');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        // 木（控えめなシルエット）
        g.fillStyle = 'rgba(70,130,70,.25)';
        [[-10, 150, 60], [370, 120, 70], [120, 190, 40]].forEach(([x, y, r]) => { g.fillRect(x - 6, y, 12, 300); D.circ(g, x, y, r, 'rgba(70,130,70,.25)'); });
        // 枝とフクロウ
        D.line(g, view.x1, 176, 262, 182, '#7a5a3a', 9);
        // 地面
        g.fillStyle = '#7cc46a'; g.beginPath(); g.moveTo(view.x0, 400); g.quadraticCurveTo(180, 380, view.x1, 400); g.lineTo(view.x1, view.y1); g.lineTo(view.x0, view.y1); g.fill();
        D.ell(g, 180, 448, 30, 10, '#8a6a4a'); // 切り株

        // 花（成功したフレーズの数だけ開く）
        const nb = fin !== null ? FLOWERS.length : st.blooms.filter(b => b <= beat).length;
        FLOWERS.forEach((f, i) => {
          let open = 0;
          if (fin !== null) open = U.prog(fin, i * 0.08, i * 0.08 + 0.6);
          else if (i < nb) open = U.prog(beat - st.blooms[i], 0, 0.6);
          if (i < st.blooms.length && fin !== null) open = 1;
          flower(g, f.x, f.y, open, f.c, beat);
        });

        // 先生の打つ動き
        let strike = 0;
        for (const c of chart.cues) {
          if (c.beat > beat + 0.01) break;
          if (c.who === 't' && beat - c.beat < 0.5) strike = 1 - (beat - c.beat) / 0.5;
        }
        const demoTap = beat - st.lastTap;
        const hitAmt = demoTap >= 0 && demoTap < 0.4 ? 1 - demoTap / 0.4 : 0;
        const dMiss = beat - st.lastMiss, dHit = beat - st.lastHit;
        const confused = dMiss >= 0 && dMiss < 1.2;
        const tilt = confused ? 0.35 * Math.sin(Math.min(1, dMiss * 4) * Math.PI / 2) : 0;
        const sqMood = fin !== null ? 'happy' : confused ? 'wide' : dHit >= 0 && dHit < 0.6 ? 'happy' : 'normal';
        const tMood = fin !== null ? 'happy' : dHit >= 0 && dHit < 0.6 ? 'happy' : 'normal';
        // 聴く時間：先生にスポットライト／返す時間：リスにスポットライト
        if (P.ph !== 'idle') {
          g.globalAlpha = 0.28; D.ell(g, P.ph === 'listen' ? TEACH.x : SQ.x, 392, 66, 16, '#fff7c0'); g.globalAlpha = 1;
        }
        rabbit(g, TEACH.x, TEACH.y, beat, strike, tMood, P.ph === 'respond');
        squirrel(g, SQ.x, SQ.y, beat, hitAmt, sqMood, tilt, P.ph === 'respond', session.judge.s.combo >= 10);
        if (confused) D.text(g, '?', SQ.x + 30, SQ.y - 92, 30, '#6b3d16', '#ffffff');

        // 一緒に演奏する仲間（成功時）
        const sing = dHit >= 0 && dHit < 0.5 ? 1 - dHit / 0.5 : 0;
        const fs = fin !== null ? Math.abs(Math.sin(fin * Math.PI * 2)) * (fin < 3 ? 1 : 0) : 0;
        owl(g, 290, 148, beat, Math.max(sing, fs));
        frog(g, 180, 432, beat, Math.max(sing, fs));
        if (sing > 0) { D.note(g, 312, 112 - (1 - sing) * 20, 1, '#6b4fa0'); D.note(g, 196, 404 - (1 - sing) * 20, 0.9, '#2f6b2e'); }
        if (strike > 0.2) D.note(g, TEACH.x + 40, TEACH.y - 70 - (1 - strike) * 16, 1, '#c2410c');

        // 吹き出し：聴く（耳マーク・丸い雲）／返す（ばちマーク・とげとげ）
        if (P.ph === 'listen') {
          D.circ(g, SQ.x - 40, SQ.y - 112, 24, '#ffffff', '#6b5a6b', 2.5);
          D.circ(g, SQ.x - 22, SQ.y - 84, 5, '#ffffff', '#6b5a6b', 2);
          g.beginPath(); g.arc(SQ.x - 40, SQ.y - 114, 10, Math.PI * 1.1, Math.PI * 0.6); g.lineWidth = 4; g.strokeStyle = '#c47a3c'; g.stroke();
          D.text(g, 'きく', SQ.x - 40, SQ.y - 145, 15, '#4a3a4a', '#ffffff');
        } else if (P.ph === 'respond') {
          D.star(g, SQ.x - 40, SQ.y - 112, 30, 20, 9, beat * 0.5, '#fff3a0', '#c2410c', 2.5);
          D.note(g, SQ.x - 44, SQ.y - 108, 1.1, '#c2410c');
          D.text(g, 'どうぞ', SQ.x - 40, SQ.y - 152, 15, '#c2410c', '#ffffff');
        }

        // フレーズの記録（上部）：先生の音＝葉っぱ、自分の音＝どんぐり。これから鳴る位置は表示しない
        if (P.inst) {
          const x0 = 70, w = 220, y1 = 52, y2 = 86;
          D.rrect(g, x0 - 16, 30, w + 32, 76, 14, 'rgba(255,255,255,.55)');
          for (let k = 0; k < 8; k++) {
            const x = x0 + k * (w / 7);
            D.circ(g, x, y1, k % 2 ? 2 : 3.5, 'rgba(90,70,60,.4)');
            D.circ(g, x, y2, k % 2 ? 2 : 3.5, 'rgba(90,70,60,.4)');
          }
          const lx = U.clamp(P.local, 0, 4) / 4, cx = x0 + (P.ph === 'listen' ? lx : U.clamp(P.local - 4, 0, 4) / 4) * w * 8 / 7;
          D.line(g, Math.min(cx, x0 + w + 14), P.ph === 'listen' ? y1 - 14 : y2 - 14, Math.min(cx, x0 + w + 14), P.ph === 'listen' ? y1 + 14 : y2 + 14, 'rgba(194,65,12,.6)', 2);
          for (const c of P.inst.cues) {
            if (c.who !== 't' || c.beat > beat) continue;
            const x = x0 + (c.beat - P.inst.start) * 2 * (w / 7);
            g.save(); g.translate(x, y1); g.rotate(-0.5); D.ell(g, 0, 0, 9, 5, '#4fa046', '#2f6b2e', 1.5); g.restore();
          }
          for (const tg of P.inst.targets) {
            const h = st.hits.get(tg);
            if (!h || h.at > beat + 0.01) continue;
            const x = x0 + (tg.beat - P.inst.start - 4) * 2 * (w / 7);
            const ok = h.kind !== 'miss';
            D.ell(g, x, y2 + 2, 7, 8, ok ? '#b5793a' : '#bbb', ok ? '#6b3d16' : '#888', 1.5);
            D.ell(g, x, y2 - 5, 8, 4, ok ? '#7a4f26' : '#999');
          }
          D.text(g, '先生', x0 - 36, y1, 12, '#4a3a4a', null, 'center', 700);
          D.text(g, 'きみ', x0 - 36, y2, 12, '#4a3a4a', null, 'center', 700);
        }

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 70); g.scale(s, s);
          D.text(g, '演奏おしまい！', 0, 0, 32, '#ffffff', '#3f8a3a');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#e3f6d2'); grd.addColorStop(1, '#8fcf7a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.save(); g.translate(36, 74); g.scale(0.5, 0.5); rabbit(g, 0, 0, t * 2, Math.max(0, Math.sin(t * 6)), 'happy', false); g.restore();
    flower(g, 82, 70, 1, '#ff8fb1', t);
    D.note(g, 70, 30 - Math.abs(Math.sin(t * 3)) * 6, 1.2, '#c2410c');
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.echo = {
    id: 'echo', title: '森のエコー楽団', color: '#3f8a3a',
    howto: '先生の「ポン」を1小節聴いて、次の小節で同じリズムをタップ',
    bpm: BPM, offset: 0,
    level: 2, patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: { pon: { id: 'pon', gain: 1 }, tickL: { id: 'tickLo', gain: 0.55 }, tickR: { id: 'tickHi', gain: 0.6 }, fin: [{ id: 'boom', gain: 0.6 }, { id: 'chime', gain: 0.8 }] },
    missSound: 'kazoo',
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
