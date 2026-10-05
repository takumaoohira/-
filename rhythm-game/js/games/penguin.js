/*
 * ミニゲーム②「ペンギン宅配便」
 *   通常便：ベル「チリーン」から 2拍後にタップ（箱が2回はねて届く）
 *   速達便：笛「ピピッ」から 1拍後にタップ（羽つき封筒が一直線に飛んでくる）
 *   荷物は常に1つずつしか飛ばない（合図と到着の対応があいまいになる重なりは作らない）
 */
(function () {
  const { U, D, Music: M } = RG;
  const BPM = 100;

  const N = (cb, len = 4) => ({ len, cues: [{ b: cb, type: 'bell', for: 0 }], inputs: [{ b: cb + 2, type: 'normal' }] });
  const patterns = {
    N: N(0),                 // チリン・・ポン
    N1: N(1),                // ・チリン・・ポン
    E: { len: 4, cues: [{ b: 0, type: 'whistle', for: 0 }], inputs: [{ b: 1, type: 'express' }] },
    E2: { len: 4, cues: [{ b: 2, type: 'whistle', for: 0 }], inputs: [{ b: 3, type: 'express' }] },
    EE: { len: 4, cues: [{ b: 0, type: 'whistle', for: 0 }, { b: 2, type: 'whistle', for: 1 }], inputs: [{ b: 1, type: 'express' }, { b: 3, type: 'express' }] },
    NE: { len: 8, cues: [{ b: 0, type: 'bell', for: 0 }, { b: 4, type: 'whistle', for: 1 }], inputs: [{ b: 2, type: 'normal' }, { b: 5, type: 'express' }] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };

  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'ペンギン宅配便、出発！' },
    { p: 'rest', sec: 'I', guide: 'ベル「チリーン」→ 2拍あとにキャッチ' },
    ...seq('N N N N N1 N', 'A'),
    { p: 'rest', sec: 'I', guide: '笛「ピピッ」は速達！ 1拍あとにキャッチ' },
    ...seq('E N E E N EE', 'B', '速達便がまざるよ'),
    ...seq('N EE N1 E2 EE N E EE', 'C', 'ラストスパート！'),
    { p: 'fin', sec: 'end', guide: '配達完了！' }
  ];

  const lessons = [
    { p: 'N', title: '通常便', hint: 'チリーン → 2拍あと（箱が2回はねたら）タップ' },
    { p: 'E', title: '速達便', hint: 'ピピッ → 1拍あとにタップ' },
    { p: 'NE', title: 'まぜて配達', hint: '通常便のあとに速達便' }
  ];

  const PROG = { A: ['F', 'C', 'Bb', 'C'], B: ['Dm', 'Bb', 'F', 'C'], C: ['F', 'Dm', 'Bb', 'C'], P: ['F', 'C', 'Bb', 'C'], I: ['C'], count: ['F'], end: ['F'] };
  const MEL = {
    A: ['A4 . C5 . A4 . F4 .', 'G4 . E4 . C4 - . .', 'F4 . D4 . F4 . Bb4 .', 'A4 - G4 - . . . .'],
    B: ['D5 . C5 . A4 . F4 .', 'F4 - G4 - A4 - Bb4 -', 'C5 . A4 . F4 . A4 .', 'G4 - - - . . . .'],
    C: ['F5 . E5 . D5 . C5 .', 'D5 . C5 . A4 - F4 .', 'Bb4 . A4 . G4 . F4 .', 'E4 - G4 - C5 - . .'],
    P: ['. . . . A4 . F4 .', '. . . . E4 . C4 .', '. . . . F4 . D4 .', '. . . . G4 - . .']
  };
  const FIFTH = { F: 'C', C: 'G', Bb: 'F', Dm: 'A', G: 'D' };
  const up = (n, k = 1) => n.replace(/(-?\d)$/, d => String(parseInt(d, 10) + k));

  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const spb = chart.spb, ch = info.chord, sec = info.sec, i = info.secBar;
    const ev = [];
    if (sec === 'count') return ev;
    if (sec === 'end') {
      ['F3', 'A3', 'C4', 'F4'].forEach((n, k) => ev.push({ b: k * 0.04, id: `marimba:${n}:1.6`, gain: 0.9 }));
      ev.push({ b: 0, id: 'bass:F2:1.6', gain: 1 }, { b: 0, id: 'kick', gain: 1 }, { b: 0, id: 'pad:F3,A3,C4,F4:2', gain: 0.7 });
      return ev;
    }
    ev.push(...M.rhythm('x.......x.......', 'kick', 0.42));
    ev.push(...M.rhythm('....o.......o...', 'snare', 0.32));
    ev.push(...M.rhythm('..x...x...x...x.', 'hat', 0.35));
    const r = M.root(ch, 2), f5 = (FIFTH[ch] || 'C') + '2';
    ev.push({ b: 0, id: `bass:${r}:0.5`, gain: 0.7 }, { b: 2, id: `bass:${f5}:0.5`, gain: 0.6 });
    // ズン・チャッ（裏の和音）
    [1, 3].forEach(b => M.chord(ch).forEach(n => ev.push({ b, id: `pizz:${n}:0.35`, gain: 0.32 })));
    const mel = MEL[sec];
    if (mel) ev.push(...M.line(mel[i % mel.length], 'marimba', { spb, gain: 0.5, tail: 0.2 }));
    return ev;
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat);
    const ch = M.chord(bar && bar.chord ? bar.chord : 'F');
    const s = [{ id: 'catchBox', gain: 0.95 }, { id: `marimba:${up(tg.type === 'express' ? ch[2] : ch[0])}:0.6`, gain: 0.5 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.5 });
    return s;
  }
  function preload() {
    const ids = ['catchBox', 'sparkle', 'drop', 'chime', 'bell', 'whistle', 'boom'];
    Object.values(M.CHORDS).forEach(c => ids.push(`marimba:${up(c[0])}:0.6`, `marimba:${up(c[2])}:0.6`));
    return ids;
  }
  function validate(chart) {
    const out = [];
    const ins = chart.inputs.filter(x => !x.demo);
    const cueOf = tg => chart.cues.find(c => c.target === tg);
    for (let i = 1; i < ins.length; i++) {
      const prev = ins[i - 1], c = cueOf(ins[i]);
      if (c && c.beat < prev.beat + 0.5) out.push(`荷物が重なっています: ${prev.beat}拍 / 次の合図 ${c.beat}拍`);
    }
    return out;
  }

  // ---------------- 描画 ----------------
  const P0 = { x: 64, y: 206 }, P1 = { x: 134, y: 268 }, C = { x: 196, y: 318 };
  const SLED = { x: 312, y: 404 };
  const FLAKES = Array.from({ length: 22 }, (_, i) => ({ x: (i * 97) % 360, s: 0.4 + (i % 4) * 0.15, r: 1.5 + (i % 3) }));

  function box(g, x, y, s, rot, express, ph = 0) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    if (express) {
      // 速達：三角の封筒＋羽＋稲妻マーク（色以外に形でも区別）
      const flap = Math.sin(ph * 25) * 0.5;
      g.save(); g.rotate(-0.4 + flap * 0.3); D.ell(g, -20, -6, 12, 6, '#ffffff', '#8aa', 1.5); g.restore();
      g.save(); g.rotate(0.4 - flap * 0.3); D.ell(g, 20, -6, 12, 6, '#ffffff', '#8aa', 1.5); g.restore();
      D.rrect(g, -17, -12, 34, 24, 4, '#fff6e0', '#c2410c', 2.5);
      g.beginPath(); g.moveTo(-17, -12); g.lineTo(0, 2); g.lineTo(17, -12); g.strokeStyle = '#c2410c'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(3, -2); g.lineTo(-4, 6); g.lineTo(1, 6); g.lineTo(-3, 13); g.lineTo(6, 3); g.lineTo(1, 3); g.closePath(); g.fillStyle = '#ffcc00'; g.fill();
    } else {
      // 通常：四角い段ボール＋テープ
      D.rrect(g, -16, -16, 32, 32, 4, '#d9a36a', '#7a4f26', 2.5);
      g.fillStyle = '#f3d29a'; g.fillRect(-4, -16, 8, 32);
      D.line(g, -16, -16, 16, -16, '#7a4f26', 2.5);
    }
    g.restore();
  }

  function penguin(g, x, y, mood, pose, beat, look) {
    g.save(); g.translate(x, y);
    const bob = U.hop(beat) * 3;
    g.translate(0, -bob);
    // 足
    D.ell(g, -14, 50 + bob, 12, 6, '#ff9f2e', '#7a4f26', 2); D.ell(g, 14, 50 + bob, 12, 6, '#ff9f2e', '#7a4f26', 2);
    // 体
    D.ell(g, 0, 0, 40, 52, '#2f3b5c', '#1b2238', 3);
    D.ell(g, 0, 12, 28, 36, '#ffffff');
    // ひれ
    const fl = (side, ang) => { g.save(); g.translate(side * 34, -2); g.rotate(ang * side); D.ell(g, side * 4, 20, 9, 24, '#2f3b5c', '#1b2238', 2.5); g.restore(); };
    if (pose === 'catch') { fl(-1, 1.25); fl(1, -0.5); }
    else if (pose === 'panic') { const w = Math.sin(beat * 20) * 0.4; fl(-1, 2.4 + w); fl(1, 2.4 - w); }
    else if (pose === 'salute') { fl(-1, 0.2); fl(1, 2.6); }
    else { const w = Math.sin(beat * Math.PI) * 0.08; fl(-1, 0.2 + w); fl(1, 0.2 - w); }
    // 顔
    D.eyes(g, -4, -26, 12, 5, mood === 'panic' ? 'wide' : mood === 'happy' ? 'happy' : mood === 'smug' ? 'smug' : 'normal', look);
    if (mood === 'happy' || mood === 'smug') D.blush(g, -4, -14, 20, 5);
    g.beginPath();
    if (mood === 'smug') { g.moveTo(-14, -18); g.lineTo(-4, -26); g.lineTo(6, -18); }
    else { g.moveTo(-14, -16); g.lineTo(-4, -8); g.lineTo(6, -16); }
    g.closePath(); g.fillStyle = '#ff9f2e'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#7a4f26'; g.stroke();
    if (mood === 'panic') { D.mouth(g, -4, -4, 6, 'o'); D.sweat(g, 32, -40, 1.1); }
    // 帽子
    g.beginPath(); g.ellipse(0, -44, 30, 15, 0, Math.PI, 0); g.fillStyle = '#3d7bd9'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1b2238'; g.stroke();
    D.rrect(g, -32, -46, 50, 7, 3, '#2b5fb0', '#1b2238', 2);
    D.circ(g, 0, -52, 5, '#ffcc00', '#1b2238', 1.5);
    if (mood === 'smug') D.star(g, 30, -40, 7, 3, 4, beat, '#ffe066');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastHit: -99, lastMiss: -99, delivered: 0, results: new Map(), combo: 0 };

    function cueFor(tg) { for (const c of chart.cues) if (c.target === tg) return c; return null; }
    function parcelPos(tg, cue, beat) {
      const ex = tg.type === 'express';
      const span = tg.beat - cue.beat;
      const u = (beat - cue.beat) / span;
      if (ex) {
        const v = U.clamp(u, 0, 1);
        return { x: U.lerp(P0.x, C.x, v), y: U.lerp(P0.y, C.y, v) - Math.sin(Math.PI * v) * 34, rot: (1 - v) * -0.3, u };
      }
      const v = U.clamp(u, 0, 1) * 2, j = Math.min(1, Math.floor(v)), w = Math.min(1, v - j);
      const a = j === 0 ? P0 : P1, b = j === 0 ? P1 : C;
      return { x: U.lerp(a.x, b.x, w), y: U.lerp(a.y, b.y, w) - Math.sin(Math.PI * w) * 48, rot: w * 0.8 + j * 0.8, u };
    }

    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') { st.lastMiss = at; st.combo = 0; }
        else { st.lastHit = at; st.combo++; }
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        // 空と山
        const grd = g.createLinearGradient(0, view.y0, 0, 420);
        grd.addColorStop(0, '#a9dcff'); grd.addColorStop(1, '#eef9ff');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#d7ecfb';
        g.beginPath(); g.moveTo(view.x0, 380); g.lineTo(40, 290); g.lineTo(120, 370); g.lineTo(220, 270); g.lineTo(330, 360); g.lineTo(view.x1, 300); g.lineTo(view.x1, 420); g.lineTo(view.x0, 420); g.fill();
        // 雪（ゆっくり）
        g.globalAlpha = 0.8;
        FLAKES.forEach((f, i) => { const y = ((beat * 12 * f.s + i * 37) % 420) + view.y0; D.circ(g, f.x + Math.sin(beat + i) * 6, y, f.r, '#ffffff'); });
        g.globalAlpha = 1;
        // 雪の地面
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(view.x0, 410); g.quadraticCurveTo(180, 385, view.x1, 405); g.lineTo(view.x1, view.y1); g.lineTo(view.x0, view.y1); g.fill();
        D.ell(g, 230, 440, 70, 10, '#e3f1fb');

        // 配達小屋（合図の出どころ）
        D.rrect(g, 0, 170, 70, 80, 6, '#e8735a', '#7a3326', 3);
        g.beginPath(); g.moveTo(-8, 174); g.lineTo(35, 128); g.lineTo(78, 174); g.closePath(); g.fillStyle = '#7a3326'; g.fill();
        D.rrect(g, 40, 188, 34, 34, 8, '#3b2b1f');
        // すべり台
        g.strokeStyle = '#b9d7ee'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(70, 226); g.quadraticCurveTo(140, 300, 186, 352); g.stroke();
        // ベル（通常便の合図で揺れる）
        let bellSw = 0, lamp = 0;
        for (const c of chart.cues) {
          if (c.beat > beat + 0.01) break;
          const d = beat - c.beat;
          if (c.type === 'bell' && d < 1.5) bellSw = Math.sin(d * 18) * Math.exp(-d * 3) * 0.6;
          if (c.type === 'whistle' && d < 1) lamp = 1 - d;
        }
        g.save(); g.translate(56, 104); g.rotate(bellSw);
        D.line(g, 0, -12, 0, 0, '#7a4f26', 3);
        g.beginPath(); g.moveTo(-14, 22); g.quadraticCurveTo(-14, 0, 0, 0); g.quadraticCurveTo(14, 0, 14, 22); g.closePath(); g.fillStyle = '#ffcc33'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#9a6a00'; g.stroke();
        D.circ(g, 0, 25, 4, '#9a6a00');
        g.restore();
        if (Math.abs(bellSw) > 0.05) { D.line(g, 80, 100, 92, 92, '#9a6a00', 2.5); D.line(g, 82, 112, 96, 112, '#9a6a00', 2.5); D.line(g, 32, 100, 20, 92, '#9a6a00', 2.5); }
        // 速達ランプ（笛の合図で回る三角の光）
        D.rrect(g, 6, 130, 22, 14, 4, '#555', '#222', 2);
        g.save(); g.translate(17, 122);
        D.circ(g, 0, 0, 10, lamp > 0 ? '#ff5a3c' : '#a33', '#222', 2);
        D.text(g, '!', 0, 1, 14, '#fff');
        if (lamp > 0) {
          g.globalAlpha = lamp * 0.55; g.rotate(beat * 10);
          for (let k = 0; k < 3; k++) { g.rotate(D.TAU / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(42, -10); g.lineTo(42, 10); g.closePath(); g.fillStyle = '#ffd36b'; g.fill(); }
        }
        g.restore();

        // そり
        const sledX = fin !== null ? SLED.x + U.ease.inCubic(U.prog(fin, 1, 3)) * 160 : SLED.x;
        D.rrect(g, sledX - 36, SLED.y - 8, 72, 18, 6, '#b5651d', '#5c3310', 2.5);
        D.line(g, sledX - 40, SLED.y + 18, sledX + 34, SLED.y + 18, '#5c3310', 3);
        g.beginPath(); g.arc(sledX + 34, SLED.y + 10, 8, -Math.PI / 2, Math.PI / 2); g.stroke();
        const shown = Math.min(st.delivered, 5);
        for (let k = 0; k < shown; k++) box(g, sledX + (k % 2 ? 8 : -8), SLED.y - 24 - k * 26, 0.8, (k % 3 - 1) * 0.06, false);
        if (st.delivered > 5) { D.rrect(g, sledX - 22, SLED.y - 182, 44, 22, 10, '#fff', '#5c3310', 2); D.text(g, `×${st.delivered}`, sledX, SLED.y - 171, 14, '#5c3310'); }

        // ペンギンの表情とポーズ
        const dTap = beat - st.lastTap, dMiss = beat - st.lastMiss, dHit = beat - st.lastHit;
        let mood = 'normal', pose = 'idle';
        if (fin !== null) { mood = 'happy'; pose = 'salute'; }
        else if (dMiss >= 0 && dMiss < 1.2) { mood = 'panic'; pose = 'panic'; }
        else if (dTap >= 0 && dTap < 0.3) { pose = 'catch'; mood = dHit >= 0 && dHit < 0.6 ? (st.combo >= 5 ? 'smug' : 'happy') : 'normal'; }
        else if (dHit >= 0 && dHit < 0.8) mood = st.combo >= 5 ? 'smug' : 'happy';
        else if (st.combo >= 5) mood = 'smug';
        penguin(g, 238, 352, mood, pose, beat, -1);

        // 荷物
        let delivered = 0;
        for (const c of chart.cues) {
          if (!c.target) continue;
          const tg = c.target, res = st.results.get(tg);
          if (res && res.kind !== 'miss' && beat - res.at > 0.5) delivered++;
          if (c.beat > beat + 0.01) break;
          const ex = tg.type === 'express';
          if (res && res.kind !== 'miss') {
            const d = beat - res.at;
            if (d > 0.5) continue;
            const v = U.ease.inOutSine(U.prog(d, 0, 0.5));
            const top = SLED.y - 24 - Math.min(st.delivered, 5) * 26;
            const x = U.lerp(C.x, sledX, v), y = U.lerp(C.y, top, v) - Math.sin(Math.PI * v) * 70;
            box(g, x, y, 1, v * D.TAU * (ex ? 1 : 0.5), ex);
            if (res.kind === 'perfect' && d < 0.4) D.star(g, C.x - 8, C.y - 30 - d * 30, 9 * (1 - d / 0.4) + 3, 4, 4, d * 3, '#ffe066');
            continue;
          }
          if (res && res.kind === 'miss') {
            const d = beat - res.at;
            if (d > 2.5) continue;
            const v = U.prog(d, 0, 0.3);
            const x = U.lerp(C.x, C.x - 10, v), y = U.lerp(C.y, 432, U.ease.inCubic(v));
            g.globalAlpha = 1 - U.prog(d, 1.8, 2.5);
            box(g, x, y, 1, v * 0.6, ex);
            if (v >= 1) { D.ell(g, x, 446, 26, 8, '#ffffff'); }
            g.globalAlpha = 1;
            continue;
          }
          const p = parcelPos(tg, c, beat);
          const pop = U.ease.outBack(U.prog(beat - c.beat, 0, 0.15));
          box(g, p.x, p.y, pop, p.rot, ex, beat);
          if (ex && p.u < 1) for (let k = 1; k <= 3; k++) D.line(g, p.x - 26 - k * 8, p.y + (k - 2) * 7, p.x - 34 - k * 14, p.y + (k - 2) * 7, 'rgba(120,150,190,.6)', 2);
        }
        st.delivered = delivered;

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 120); g.scale(s, s);
          D.text(g, '配達完了！', 0, 0, 36, '#ffffff', '#2b5fb0');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#a9dcff'); grd.addColorStop(1, '#eef9ff');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.fillStyle = '#fff'; g.fillRect(0, 80, 100, 20);
    g.save(); g.translate(56, 62); g.scale(0.62, 0.62); penguin(g, 0, 0, 'happy', 'idle', t * 2, 0); g.restore();
    box(g, 22, 40 - Math.abs(Math.sin(t * 3)) * 8, 0.7, 0.2, false);
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.penguin = {
    id: 'penguin', title: 'ペンギン宅配便', color: '#3d7bd9',
    howto: 'ベル「チリーン」→2拍あと、笛「ピピッ」→1拍あとにタップでキャッチ',
    bpm: BPM, offset: 0,
    patterns, main, lessons, finalePattern: 'fin',
    cueSounds: { bell: { id: 'bell', gain: 1.6 }, whistle: { id: 'whistle', gain: 1.5 }, fin: [{ id: 'boom', gain: 0.7 }, { id: 'chime', gain: 0.8 }] },
    missSound: 'drop',
    chordFor, music, hitSounds, preload, createScene, drawIcon, validate
  };
})();
