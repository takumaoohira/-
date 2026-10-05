/*
 * ミニゲーム①「月面もちつき」
 *   通常：トン（1拍目）・トン（2拍目）→ 3拍目でタップ「ペタン」→ 4拍目は休み
 *   2連続：トン（1拍目）・カッカッ（2拍目とその裏）→ 3拍目とその裏で「ペタペタ」
 */
(function () {
  const { U, D, Music: M } = RG;
  const BPM = 104;

  const patterns = {
    A: { len: 4, cues: [{ b: 0, type: 'ton', who: 'a' }, { b: 1, type: 'ton', who: 'b' }], inputs: [{ b: 2, type: 'hit' }] },
    B: { len: 4, cues: [{ b: 0, type: 'ton', who: 'a' }, { b: 1, type: 'ka', who: 'b' }, { b: 1.5, type: 'ka', who: 'b' }], inputs: [{ b: 2, type: 'hit' }, { b: 2.5, type: 'hit2' }] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };

  // 本編：前半＝通常のみ → 中盤＝2連続を導入 → 後半＝組み合わせ → 締め（約55秒）
  const main = [
    { p: 'count', sec: 'count', guide: 'トン・トン・ペタン！' },
    { p: 'rest', sec: 'I', guide: '「トン・トン」のあと、3拍目でタップ' },
    ...'AAAAAA'.split('').map(p => ({ p, sec: 'A' })),
    { p: 'rest', sec: 'I', guide: '「カッカッ」が来たら　ペタペタ（2回）！' },
    ...'BABAAB'.split('').map((p, i) => ({ p, sec: 'B', guide: i === 0 ? 'カッカッ → ペタペタ' : null })),
    ...'ABBABAAB'.split('').map((p, i) => ({ p, sec: 'C', guide: i === 0 ? 'まぜていくよ！' : null })),
    { p: 'fin', sec: 'end', guide: 'おもち、できあがり！' }
  ];

  const lessons = [
    { p: 'A', title: 'ふつうのペタン', hint: 'トン・トン・ペタン（3拍目でタップ）' },
    { p: 'B', title: '2連続ペタペタ', hint: 'トン・カッカッ・ペタペタ（3拍目とその裏）' }
  ];

  const PROG = {
    A: ['C', 'Am', 'F', 'G'], B: ['F', 'G', 'Em', 'Am'], C: ['C', 'Am', 'F', 'G'], P: ['C', 'Am', 'F', 'G'],
    I: ['G'], count: ['C'], end: ['C']
  };
  const MEL = {
    A: ['C5 - - D5 E5 - D5 -', 'C5 - A4 - - - G4 -', 'A4 - C5 - D5 - C5 -', 'D5 - - - . . . .'],
    B: ['A4 . C5 . F5 - E5 -', 'D5 - - . G4 - - .', 'E5 . D5 . B4 - G4 -', 'A4 - - - C5 - D5 -'],
    C: ['E5 - D5 - C5 - D5 E5', 'C5 - A4 - G4 - A4 -', 'C5 - D5 - E5 - G5 -', 'E5 - D5 - . . . .'],
    P: ['. . . . E5 - D5 -', '. . . . C5 - . .', '. . . . D5 - C5 -', '. . . . . . . .'],
    I: ['. . . . . . G4 A4']
  };
  const up = (n, k = 1) => n.replace(/(-?\d)$/, d => String(parseInt(d, 10) + k));

  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }

  function music(info, chart) {
    const spb = chart.spb, ch = info.chord, sec = info.sec, i = info.secBar;
    const ev = [];
    if (sec === 'count') return ev;
    if (sec === 'end') {
      M.strum('C', 0, 'koto', 0.7, 0.05, 2.5).forEach(e => ev.push(e));
      ev.push({ b: 0, id: 'pad:C4,E4,G4,C5:2.2', gain: 0.9 }, { b: 0, id: 'bass:C2:1.8', gain: 1 }, { b: 0, id: 'kick', gain: 1 });
      return ev;
    }
    const root = M.root(ch, 2);
    ev.push(...M.rhythm('x.......x.......', 'kick', 0.42));
    ev.push(...M.rhythm('..o...o...o...o.', 'shaker', 0.8));
    if (sec === 'C') ev.push(...M.rhythm('....x.......x...', 'rim', 0.5));
    ev.push({ b: 0, id: `bass:${root}:0.9`, gain: 0.75 }, { b: 2.5, id: `bass:${root}:0.6`, gain: 0.6 });
    ev.push({ b: 0, id: `pad:${M.chord(ch).join(',')}:${(spb * 4).toFixed(1)}`, gain: sec === 'I' ? 0.8 : 0.55 });
    const mel = MEL[sec];
    if (mel) ev.push(...M.line(mel[i % mel.length], 'koto', { spb, gain: 0.5 }));
    return ev;
  }

  function hitNote(chart, tg) {
    const bar = chart.barAt(tg.beat);
    const ch = M.chord(bar && bar.chord ? bar.chord : 'C');
    return up(tg.k === 1 ? ch[2] : ch[0], 1);
  }
  function hitSounds(tg, kind, chart) {
    const s = [{ id: 'slap', gain: 0.95 }, { id: `koto:${hitNote(chart, tg)}:0.8`, gain: 0.55 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.55 });
    return s;
  }
  function preload() {
    const ids = ['slap', 'sparkle', 'chime', 'boom', 'miss', 'ka', 'ton'];
    Object.values(M.CHORDS).forEach(c => { ids.push(`koto:${up(c[0])}:0.8`, `koto:${up(c[2])}:0.8`); });
    return ids;
  }

  // ---------------- 描画 ----------------
  const COL = { a: '#7ee0b5', b: '#c3a6ff', p: '#ffb36b', spect: ['#ffd36b', '#8fd3ff', '#ff9fb8'] };
  const STARS = Array.from({ length: 26 }, (_, i) => ({ x: (i * 137.5) % 360, y: 20 + ((i * 89) % 230), r: 0.8 + (i % 3) * 0.5, p: i * 0.37 }));

  function alien(g, x, y, s, color, mood, beat, opt = {}) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (opt.tilt) g.rotate(opt.tilt);
    // アンテナ
    const sway = Math.sin(beat * Math.PI) * 0.15;
    D.line(g, 0, -28, Math.sin(sway) * 14, -48, '#4b4466', 2.5);
    D.circ(g, Math.sin(sway) * 14, -50, 5, opt.glow ? '#fff27a' : '#ffe680', '#4b4466', 2);
    // 体
    g.beginPath(); g.moveTo(-26, 20); g.bezierCurveTo(-30, -30, 30, -30, 26, 20); g.quadraticCurveTo(0, 32, -26, 20);
    g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = '#4b4466'; g.stroke();
    D.eyes(g, 0, -6, 9, 5, mood, 0);
    if (mood === 'happy' || mood === 'smug') D.blush(g, 0, 4, 15, 5);
    D.mouth(g, 0, 9, 5, mood === 'happy' ? 'smile' : mood === 'wide' ? 'o' : mood === 'x' ? 'wavy' : 'smile');
    g.restore();
  }
  function mallet(g, px, py, ang, len, headW, headH, dir) {
    g.save(); g.translate(px, py); g.scale(dir, 1); g.rotate(ang);
    D.line(g, 0, 0, 0, -len, '#8a5a32', 5);
    D.rrect(g, -headW / 2, -len - headH / 2, headW, headH, 5, '#c98a4b', '#6b4426', 2.5);
    g.restore();
  }
  // 拍に合わせた「振りかぶり → 打つ → 戻る」
  function swing(beat, hits, rest, back, strike) {
    let best = null, bd = 1e9;
    for (const h of hits) { const d = beat - h; if (d >= -0.5 && d < 0.4 && Math.abs(d) < bd) { bd = Math.abs(d); best = d; } }
    if (best === null) return rest + Math.sin(beat * Math.PI) * 0.04;
    const d = best;
    if (d < -0.12) return U.lerp(rest, back, U.ease.outCubic(U.prog(d, -0.5, -0.12)));
    if (d < 0) return U.lerp(back, strike, U.prog(d, -0.12, 0));
    return U.lerp(strike, rest, U.ease.inOutSine(U.prog(d, 0.05, 0.4)));
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, hit: null, miss: null, lastGood: -99, lastMiss: -99, perfects: 0 };

    function cuesNear(beat, who) {
      const out = [];
      for (const c of chart.cues) {
        if (c.beat > beat + 1) break;
        if (c.beat > beat - 1 && c.who === who) out.push(c.beat);
      }
      return out;
    }
    function nextTargetIn(beat, within) {
      for (const tg of chart.inputs) { if (tg.beat > beat + within) break; if (tg.beat >= beat - 0.05) return tg; }
      return null;
    }
    function finBeat() { const f = chart.fx.find(x => x.type === 'finale'); return f ? f.beat : null; }

    return {
      onJudge(tg, kind, vbeat, r) {
        if (kind === 'miss') { st.miss = { beat: vbeat, tg }; st.lastMiss = vbeat; return; }
        st.hit = { beat: r && r.demo ? tg.beat : vbeat, kind, k: tg.k, demo: !!(r && r.demo) };
        st.lastGood = st.hit.beat;
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const fb = finBeat();
        const fin = fb !== null && beat >= fb - 0.02 ? beat - fb : null;
        // 背景
        const grd = g.createLinearGradient(0, view.y0, 0, view.y1);
        grd.addColorStop(0, '#171a3d'); grd.addColorStop(1, '#343a7a');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        STARS.forEach(s => { g.globalAlpha = 0.55 + 0.3 * Math.sin(beat * 0.5 + s.p); D.circ(g, s.x, s.y, s.r, '#fff7cf'); });
        g.globalAlpha = 1;
        D.circ(g, 312, 66, 20, '#4fa3e0'); D.ell(g, 306, 60, 9, 6, '#6fd48a'); D.ell(g, 320, 74, 6, 4, '#6fd48a');
        // 月面
        g.fillStyle = '#c9c4dc'; g.beginPath(); g.ellipse(180, view.y1 + 260, 520, 340 + (view.y1 - 540), 0, 0, D.TAU); g.fill();
        D.ell(g, 70, 470, 26, 7, '#b3adc9'); D.ell(g, 300, 500, 34, 9, '#b3adc9'); D.ell(g, 240, 460, 14, 4, '#b3adc9');

        // 状態
        const hd = st.hit ? beat - st.hit.beat : 99;
        const md = st.miss ? beat - st.miss.beat : 99;
        const missRecent = md >= 0 && md < 1.4;
        const shift = md >= 0 && md < 1 ? 10 * (1 - U.ease.outCubic(md)) : 0;

        // プレイヤー（奥）
        const pMood = fin !== null ? 'happy' : missRecent ? 'x' : hd < 0.8 && st.hit.kind === 'perfect' ? 'happy' : 'normal';
        const pHop = fin !== null ? -24 * Math.max(0, Math.sin(Math.min(fin, 1) * Math.PI)) : -U.hop(beat) * 3;
        alien(g, 180, 262 + pHop, 1.7, COL.p, pMood, beat);
        if (missRecent) { // 顔にお餅
          const a = U.prog(md, 0, 0.15) * (1 - U.prog(md, 1.1, 1.4));
          g.globalAlpha = a;
          g.beginPath(); g.ellipse(180, 252 + pHop, 30, 22, 0.15, 0, D.TAU); g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#d9cfb8'; g.stroke();
          D.ell(g, 160, 270 + pHop, 8, 10, '#fffaf0'); D.ell(g, 202, 238 + pHop, 7, 6, '#fffaf0');
          g.globalAlpha = 1;
          D.sweat(g, 222, 228 + pHop, 1.2);
        }

        // 臼
        const ux = 180 + shift;
        g.fillStyle = '#9a6236'; g.beginPath(); g.moveTo(ux - 66, 384); g.lineTo(ux - 56, 458); g.quadraticCurveTo(ux, 470, ux + 56, 458); g.lineTo(ux + 66, 384); g.fill();
        g.lineWidth = 3; g.strokeStyle = '#5c381c'; g.stroke();
        D.line(g, ux - 62, 412, ux + 62, 412, '#7a4a26', 3); D.line(g, ux - 59, 438, ux + 59, 438, '#7a4a26', 3);
        D.ell(g, ux, 384, 68, 17, '#b47844', '#5c381c', 3);
        D.ell(g, ux, 386, 56, 11, '#6b4426');

        // お餅
        const amp = hd >= 0 && hd < 2 ? Math.exp(-hd * 4) : 0;
        const wob = Math.cos(hd * 15) * amp;
        let sx = 1 + 0.42 * wob, sy = 1 - 0.38 * wob;
        if (missRecent) { sx *= 0.8; sy *= 0.8; }
        const shape = fin !== null ? 'fullmoon' : st.hit && st.hit.kind === 'perfect' && hd >= 0.04 && hd < 1.3 ? (st.hit.k === 1 ? 'moon' : 'star') : null;
        g.save(); g.translate(ux, 376); g.scale(sx, sy);
        const morph = shape && shape !== 'fullmoon' ? U.prog(hd, 0.04, 0.16) * (1 - U.prog(hd, 1.0, 1.3)) : shape ? U.prog(fin, 0, 0.2) : 0;
        g.globalAlpha = 1 - morph * 0.9;
        g.beginPath(); g.ellipse(0, 0, 50, 18, 0, Math.PI, 0); g.quadraticCurveTo(48, 10, 0, 12); g.quadraticCurveTo(-48, 10, -50, 0);
        g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#d9cfb8'; g.stroke();
        D.ell(g, -14, -8, 12, 4, '#ffffff');
        g.globalAlpha = morph;
        if (shape === 'star') D.star(g, 0, -14, 40, 19, 5, 0, '#fffaf0', '#e8c96a', 3);
        else if (shape === 'moon') { D.crescent(g, -4, -16, 34, '#fffaf0'); g.lineWidth = 2; }
        else if (shape === 'fullmoon') { D.circ(g, 0, -30, 46, '#fff6c8', '#e8c96a', 3); D.ell(g, -14, -42, 8, 6, '#f3e3a0'); D.ell(g, 12, -20, 6, 5, '#f3e3a0'); }
        g.globalAlpha = 1;
        g.restore();
        if (shape && morph > 0.5) {
          for (let i = 0; i < 4; i++) {
            const a = i * 1.57 + (hd || 0) * 2, r = 58 + 10 * (hd || 0);
            D.star(g, ux + Math.cos(a) * r, 350 + Math.sin(a) * r * 0.5, 6, 2.5, 4, 0, '#fff27a');
          }
        }

        // 手伝いの宇宙人（左＝1拍目のトン、右＝2拍目のトン／カッカッ）
        const aHits = cuesNear(beat, 'a'), bHits = cuesNear(beat, 'b');
        const helperMood = missRecent ? 'wide' : hd < 0.8 && st.hit.kind === 'perfect' ? 'happy' : 'normal';
        const hopA = fin !== null ? -30 * Math.max(0, Math.sin(Math.min(fin, 1) * Math.PI)) : 0;
        alien(g, 58, 404 + hopA, 1, COL.a, helperMood, beat);
        mallet(g, 82, 396 + hopA, swing(beat, aHits, -0.35, -0.8, 1.32), 58, 30, 18, 1);
        // 2連続の合図のときは「×2」の札を掲げる（色ではなく形と文字で区別）
        let kaNear = null;
        for (const c of chart.cues) { if (c.beat > beat + 0.5) break; if (c.type === 'ka' && beat - c.beat < 1.6) kaNear = c; }
        alien(g, 302, 404 + hopA, 1, COL.b, helperMood, beat, { glow: !!kaNear });
        mallet(g, 278, 396 + hopA, swing(beat, bHits, -0.35, -0.8, 1.32), 58, 30, 18, -1);
        if (kaNear) {
          const ka = kaNear.beat - (kaNear.beat % 1 === 0.5 ? 0.5 : 0);
          const show = U.prog(beat, ka - 0.5, ka - 0.3) * (1 - U.prog(beat, ka + 1.4, ka + 1.6));
          g.save(); g.translate(318, 330 - 8 * show); g.globalAlpha = show; g.rotate(Math.sin(beat * Math.PI * 2) * 0.05);
          D.line(g, 0, 10, 0, 40, '#6b4426', 4);
          D.rrect(g, -26, -22, 52, 36, 8, '#fff3c4', '#6b4426', 3);
          D.text(g, '×2', 0, -4, 22, '#c2410c');
          g.restore();
        }

        // プレイヤーのきね（手前に振り下ろす）
        const dTap = beat - st.lastTap;
        const nt = nextTargetIn(beat, 0.7);
        let phi;
        if (dTap >= 0 && dTap < 0.1) phi = U.lerp(0.2, Math.PI, U.ease.inCubic(dTap / 0.1));
        else if (dTap >= 0.1 && dTap < 0.42) phi = U.lerp(Math.PI, 0.35, U.ease.inOutSine(U.prog(dTap, 0.16, 0.42)));
        else if (nt) phi = U.lerp(0.35, -0.3, U.ease.outCubic(U.prog(beat, nt.beat - 0.7, nt.beat - 0.12)));
        else phi = 0.35 + Math.sin(beat * Math.PI) * 0.05;
        const c = (1 - Math.cos(phi)) / 2;
        const hx = U.lerp(246, 214, c), hy = U.lerp(226, 300, c) + pHop * 0.5;
        const L = 76, hs = 1 + 0.35 * Math.sin(Math.max(0, Math.min(Math.PI, phi)));
        const tipX = U.lerp(hx + 4, 200, c), tipY = hy - L * Math.cos(phi);
        // 伸びるお餅（打った直後に糸を引く）
        if (st.hit && hd >= 0.02 && hd < 0.5 && dTap < 0.6) {
          const w = 18 * (1 - hd / 0.5);
          g.beginPath(); g.moveTo(ux + 16 - w, 366); g.quadraticCurveTo(tipX, (tipY + 366) / 2 + 10, tipX - w * 0.4, tipY + 10);
          g.lineTo(tipX + w * 0.4, tipY + 10); g.quadraticCurveTo(tipX, (tipY + 366) / 2 + 10, ux + 16 + w, 366); g.closePath();
          g.fillStyle = '#fffaf0'; g.fill();
        }
        // 腕（体の右側から両手へ）
        D.line(g, 214, 266 + pHop, hx, hy + 4, '#4b4466', 13); D.line(g, 214, 266 + pHop, hx, hy + 4, COL.p, 8);
        D.line(g, 206, 284 + pHop, hx - 8, hy + 8, '#4b4466', 13); D.line(g, 206, 284 + pHop, hx - 8, hy + 8, COL.p, 8);
        D.line(g, hx, hy, tipX, tipY, '#8a5a32', 7);
        D.rrect(g, tipX - 32 * hs, tipY - 13 * hs, 64 * hs, 26 * hs, 8, '#d39556', '#6b4426', 3);
        D.circ(g, hx - 8, hy + 6, 8, COL.p, '#4b4466', 2.5); D.circ(g, hx + 2, hy, 8, COL.p, '#4b4466', 2.5);

        // まわりの宇宙人（拍に合わせて跳ねる）
        const boost = 1 + 2.5 * U.decay(beat - st.lastGood, 1.2);
        [[40, 520], [320, 524], [110, 532]].forEach(([x, y], i) => {
          const hop = fin !== null ? 26 * Math.abs(Math.sin(fin * Math.PI)) * (fin < 3 ? 1 : 0) : U.hop(beat + i * 0.0) * 6 * boost;
          alien(g, x, y - hop, 0.55, COL.spect[i], missRecent ? 'wide' : boost > 1.5 ? 'happy' : 'normal', beat, { tilt: missRecent ? 0.15 * (i % 2 ? 1 : -1) : 0 });
        });

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 140); g.scale(s, s);
          D.text(g, 'おもち完成！', 0, 0, 34, '#fff6c8', '#4b2e83');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#1b1f4a'); grd.addColorStop(1, '#3a3f86');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    D.ell(g, 50, 108, 70, 30, '#c9c4dc');
    alien(g, 50, 52 - Math.abs(Math.sin(t * 3)) * 5, 0.8, COL.p, 'happy', t * 2);
    D.ell(g, 50, 84, 26, 9, '#fffaf0', '#d9cfb8', 2);
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.mochi = {
    id: 'mochi', title: '月面もちつき', color: '#4b4fa3',
    howto: '「トン・トン」のあと、3拍目でタップ。「カッカッ」の後は2回！',
    bpm: BPM, offset: 0,
    patterns, main, lessons, finalePattern: 'fin',
    cueSounds: { ton: { id: 'ton', gain: 1.5 }, ka: { id: 'ka', gain: 1.0 }, fin: [{ id: 'boom', gain: 0.9 }, { id: 'chime', gain: 0.8 }] },
    missSound: 'miss',
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
