/*
 * ミニゲーム⑤「グルーヴ・ゴルフ」（スポーツ・むずかしめ）
 *   ドライブ：DJモグラがボールを置く「コトッ」→ 素振り「シュッ」→ 次の拍で打つ（コトッ・シュッ・カキーン）
 *   チップ  ：スクラッチ「キュッ・キュッ」→ 2拍目の裏で打つ（裏拍）
 *   ラッシュ：「コトコトコト」と3球 → 同じ間隔で3連打
 *   パット  ：「コン」→ 3拍数えて打つ（ハード用。合図のない間を数える）
 */
(function () {
  const { U, D, Music: M } = RG;

  const patterns = {
    D: { len: 4, cues: [{ b: 0, type: 'tee', for: 0 }, { b: 1, type: 'waggle' }], inputs: [{ b: 2, type: 'drive' }] },
    C: { len: 4, cues: [{ b: 0, type: 'scratch', for: 0 }, { b: 0.5, type: 'scratch' }], inputs: [{ b: 1.5, type: 'chip' }] },
    CC: { len: 4, cues: [{ b: 0, type: 'scratch', for: 0 }, { b: 0.5, type: 'scratch' }, { b: 2, type: 'scratch', for: 1 }, { b: 2.5, type: 'scratch' }], inputs: [{ b: 1.5, type: 'chip' }, { b: 3.5, type: 'chip' }] },
    T: { len: 4, cues: [{ b: 0, type: 'tee', for: 0 }, { b: 0.5, type: 'tee', for: 1 }, { b: 1, type: 'tee', for: 2 }], inputs: [{ b: 2, type: 'rush' }, { b: 2.5, type: 'rush' }, { b: 3, type: 'rush' }] },
    P: { len: 4, cues: [{ b: 0, type: 'putt', for: 0 }], inputs: [{ b: 3, type: 'putt' }] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first, guides = {}) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : guides[i] || null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'グルーヴ・ゴルフ、ティーオフ！' },
    { p: 'rest', sec: 'I', guide: 'コトッ・シュッ・カキーン！' },
    ...seq('D D D D D D', 'A'),
    { p: 'rest', sec: 'I', guide: '「キュッ・キュッ」のあとは裏で打つ！' },
    ...seq('C D C D C C', 'B'),
    ...seq('T D C T D C T C', 'C', '「コトコトコト」は3連打！'),
    { p: 'fin', sec: 'end', guide: 'ホールアウト！' }
  ];
  const hard = {
    bpm: 120,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 風が強いぞ' },
      { p: 'rest', sec: 'I', guide: '「コン」のパットは、3拍数えて打つ' },
      ...seq('D C T CC D P', 'A'),
      ...seq('P CC T C P CC', 'B', 'チップ連続とパット！'),
      ...seq('T CC P T CC C T CC', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'ホールアウト！' }
    ]
  };
  const lessons = [
    { p: 'D', title: 'ドライブ', hint: 'コトッ・シュッ・カキーン（3拍目）' },
    { p: 'C', title: 'チップ（裏拍）', hint: 'キュッ・キュッ・ン・カッ（2拍目の裏）' },
    { p: 'T', title: 'ラッシュ', hint: 'コトコトコト → カンカンカン（同じ間隔で）' },
    { p: 'P', title: 'パット（ハード用）', hint: 'コン・1・2・カツッ（3拍あと）' }
  ];

  // ---- 曲（Gマイナーのファンク） ----
  const CH = {
    Gm7: { root: 'G', notes: ['A#3', 'D4', 'F4'] }, C7: { root: 'C', notes: ['A#3', 'E4', 'G4'] },
    'D#maj7': { root: 'D#', notes: ['D4', 'G4', 'A#4'] }, D7: { root: 'D', notes: ['C4', 'F#4', 'A4'] }
  };
  const PROG = { A: ['Gm7', 'C7'], B: ['D#maj7', 'D7', 'Gm7', 'C7'], C: ['Gm7', 'C7', 'D#maj7', 'D7'], P: ['Gm7', 'C7'], I: ['D7'], count: ['Gm7'], end: ['Gm7'] };
  const RIFF = [[0, 0, 0.25], [0.5, 0, 0.15], [1.25, 12, 0.15], [2, 7, 0.2], [2.75, 10, 0.15], [3.25, 12, 0.15]];
  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const tr = (root, oct, semi) => { const i = NOTE_ORDER.indexOf(root) + semi; return NOTE_ORDER[((i % 12) + 12) % 12] + (oct + Math.floor(i / 12)); };
  const pc = n => n.replace(/-?\d$/, '');

  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  const RIFFS = { C: ['G5 . A#5 . C6 . D6 -', '. . C6 . A#5 . G5 -', 'A#5 . G5 . F5 . G5 -', '. . . . D5 - F5 -'] };
  function music(info, chart) {
    const sec = info.sec, i = info.secBar;
    if (sec === 'count') return [{ b: 0, id: 'hh2:o:0.3', gain: 0.2 }, { b: 2, id: 'hh2:o:0.3', gain: 0.2 }];
    if (sec === 'end') return RG.Band.ending('Gm7').concat([{ b: 0, id: 'brass:G4,A#4,D5,F5:0.9', gain: 0.8, rev: 0.3 }]);
    const ev = RG.Band.bar(info, chart, {
      style: 'funk', chord: info.chord, drums: 0.75, comp: 0.7, bass: 0.8, pad: sec === 'B' ? 0.2 : 0,
      mel: RIFFS[sec] ? RIFFS[sec][i % 4] : null, melInst: 'lead', melGain: 0.35, melPan: 0.3
    });
    if (info.secBar % 4 === 0 && sec !== 'I' && sec !== 'P') { const ch = RG.Band.chord(info.chord); ev.push({ b: 0, id: `brass:${ch.notes.map(n => tr(pc(n), 4, 0)).join(',')}:0.25`, gain: 0.45, pan: 0.2, rev: 0.2 }); }
    return ev;
  }

  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat);
    const ch = CH[bar && bar.chord] || CH.Gm7;
    const s = [{ id: tg.type === 'putt' ? 'tee' : 'golfHit', gain: 1 }, { id: `clav:${tr(pc(ch.notes[tg.k % 3]), 5, 0)}:0.2`, gain: 0.45 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.4 });
    return s;
  }
  function preload() {
    const ids = ['golfHit', 'tee', 'waggle', 'scratch', 'rim', 'cup', 'splash', 'cheer', 'whiff', 'sparkle'];
    Object.values(CH).forEach(c => c.notes.forEach(n => ids.push(`clav:${tr(pc(n), 5, 0)}:0.2`)));
    return ids;
  }

  // ---------------- 描画 ----------------
  const T = { x: 134, y: 412 }, HOLE = { x: 322, y: 356 }, POND = { x: 236, y: 474 }, MOLE = { x: 44, y: 396 };
  const arc = (a, b, u, h) => ({ x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u) - Math.sin(Math.PI * U.clamp(u, 0, 1)) * h });

  function flamingo(g, x, y, beat, club, mood, cool) {
    g.save(); g.translate(x, y);
    const bob = U.hop(beat) * 3;
    // 脚（ベルボトム）
    D.line(g, -6, 10, -10, 80, '#ff6fa5', 5); D.line(g, 8, 10, 12, 80, '#ff6fa5', 5);
    g.beginPath(); g.moveTo(-14, 52); g.lineTo(-4, 52); g.lineTo(-2, 82); g.lineTo(-20, 82); g.closePath(); g.fillStyle = '#ffc93a'; g.fill();
    g.beginPath(); g.moveTo(4, 52); g.lineTo(16, 52); g.lineTo(22, 82); g.lineTo(4, 82); g.closePath(); g.fill();
    g.translate(0, -bob);
    D.ell(g, 0, 0, 30, 22, '#ff86b4', '#b0306a', 3);
    // 首と頭
    g.beginPath(); g.moveTo(14, -10); g.bezierCurveTo(30, -40, 0, -50, 16, -76); g.lineWidth = 9; g.strokeStyle = '#ff86b4'; g.lineCap = 'round'; g.stroke();
    for (let k = 0; k < 10; k++) D.circ(g, 16 + Math.cos(k / 10 * D.TAU) * 20, -96 + Math.sin(k / 10 * D.TAU) * 14, 13, '#2a1420');
    D.circ(g, 18, -80, 15, '#ff86b4', '#b0306a', 2.5);
    if (mood === 'confused') D.eyes(g, 18, -82, 6, 3.5, 'wide');
    else if (cool) D.shades(g, 18, -82, 7, 5.5);
    else D.eyes(g, 18, -82, 6, 3.5, mood === 'happy' ? 'happy' : 'normal', 1);
    g.beginPath(); g.moveTo(30, -80); g.quadraticCurveTo(44, -78, 40, -66); g.lineTo(32, -72); g.closePath(); g.fillStyle = '#2a1420'; g.fill();
    // クラブ（翼で持つ）
    g.save(); g.translate(6, 4); g.rotate(club);
    D.line(g, 0, 0, 0, 72, '#c0c0d0', 3.5);
    D.rrect(g, -3, 68, 14, 7, 2, '#606070', '#202030', 1.5);
    g.restore();
    D.ell(g, 4, 6, 12, 8, '#ff6fa5', '#b0306a', 2);
    g.restore();
  }
  function mole(g, x, y, beat, scratch, toss) {
    g.save(); g.translate(x, y - U.hop(beat) * 2);
    // ターンテーブル
    D.rrect(g, -6, 6, 52, 22, 4, '#2a2a3a', '#000', 2);
    D.ell(g, 18, 10, 20, 6, '#111', '#444', 1.5);
    g.save(); g.translate(18, 10); g.scale(1, 0.3); g.rotate(beat * 4 + scratch * 3); D.line(g, 0, 0, 16, 0, '#ff3d6e', 3); g.restore();
    // 体
    D.ell(g, 0, -10, 24, 26, '#7a5a3a', '#3a2410', 3);
    D.circ(g, 0, -40, 18, '#7a5a3a', '#3a2410', 3);
    D.ell(g, 8, -36, 6, 4, '#ff9fb8');
    D.shades(g, 0, -44, 7, 5);
    // ヘッドホン
    g.beginPath(); g.arc(0, -42, 20, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 4; g.strokeStyle = '#ffc93a'; g.stroke();
    D.rrect(g, -24, -48, 8, 14, 3, '#ff3d6e'); D.rrect(g, 16, -48, 8, 14, 3, '#ff3d6e');
    // 手：スクラッチ／ボールを投げる
    const hx = scratch > 0 ? 18 + Math.sin(scratch * 12) * 6 : 20 + toss * 10, hy = scratch > 0 ? 6 : -16 - toss * 10;
    D.circ(g, hx, hy, 6, '#7a5a3a', '#3a2410', 2);
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastHit: -99, lastMiss: -99, perfect: -99, results: new Map() };
    let cache = null, cacheLen = -1;
    function ballCues() { if (cacheLen !== chart.cues.length) { cache = chart.cues.filter(c => c.target); cacheLen = chart.cues.length; } return cache; }

    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at, tapped: !(kind === 'miss' && (!r || r.diff === null)) });
        if (kind === 'miss') {
          st.lastMiss = at;
          if (r && r.diff !== null && r.diff !== undefined) session.playLater('splash', session.spb * 0.7, 0.7);
        } else {
          st.lastHit = at;
          if (kind === 'perfect') { st.perfect = at; session.playLater('cup', session.spb * 1.0, 0.9); session.playLater('cheer', session.spb * 1.0, 0.35); }
        }
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 70年代風の縞の夕焼け
        const bands = ['#2b1640', '#5a1f63', '#a8246e', '#e8483a', '#ff7a1a', '#ffc23a'];
        const top = view.y0, hz = 300;
        bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(view.x0, top + (hz - top) * i / bands.length, view.x1 - view.x0, (hz - top) / bands.length + 1); });
        g.save(); g.beginPath(); g.rect(view.x0, top, view.x1 - view.x0, hz - top); g.clip();
        D.circ(g, 210, hz, 70, '#ffe28a');
        g.fillStyle = '#ff7a1a'; for (let k = 0; k < 4; k++) g.fillRect(130, hz - 12 - k * 15, 160, 4 + k);
        g.restore();
        // 丘
        g.fillStyle = '#1e7a50'; g.beginPath(); g.moveTo(view.x0, 320); g.quadraticCurveTo(90, 270, 200, 312); g.quadraticCurveTo(290, 290, view.x1, 316); g.lineTo(view.x1, view.y1); g.lineTo(view.x0, view.y1); g.fill();
        g.fillStyle = '#2fa36b'; g.beginPath(); g.moveTo(view.x0, 380); g.quadraticCurveTo(150, 340, view.x1, 372); g.lineTo(view.x1, view.y1); g.lineTo(view.x0, view.y1); g.fill();
        g.fillStyle = '#3cbf7c'; g.fillRect(view.x0, 414, view.x1 - view.x0, view.y1 - 414);
        // グリーンと旗
        D.ell(g, HOLE.x, HOLE.y + 2, 40, 9, '#6fe0a0');
        D.ell(g, HOLE.x, HOLE.y + 1, 5, 2, '#123');
        const dp = beat - st.perfect;
        const wave = Math.sin(beat * Math.PI * 2) * 4 + (dp >= 0 && dp < 2 ? Math.sin(dp * 20) * 6 : 0);
        D.line(g, HOLE.x, HOLE.y, HOLE.x, HOLE.y - 62, '#eee', 2.5);
        g.beginPath(); g.moveTo(HOLE.x, HOLE.y - 62); g.quadraticCurveTo(HOLE.x + 14, HOLE.y - 56 + wave, HOLE.x + 28, HOLE.y - 52 + wave); g.lineTo(HOLE.x, HOLE.y - 44); g.closePath(); g.fillStyle = '#ff3d6e'; g.fill();
        // ギャラリー（アフロのシルエット）
        for (let i = 0; i < 4; i++) {
          const x = 236 + i * 24, cheer = (dp >= 1 && dp < 2.2) || fin !== null ? 8 * Math.abs(Math.sin(beat * Math.PI * 2 + i)) : U.hop(beat + i * 0.25) * 2;
          for (let k = 0; k < 6; k++) D.circ(g, x + Math.cos(k) * 7, 292 - cheer + Math.sin(k) * 5, 7, '#2b1640');
          D.ell(g, x, 312 - cheer, 8, 12, '#2b1640');
          if (cheer > 5) D.line(g, x + 6, 304 - cheer, x + 12, 290 - cheer, '#2b1640', 3);
        }
        // 池
        D.ell(g, POND.x, POND.y, 70, 16, '#3a8fd8', '#1d5a90', 2);

        // DJモグラ（スクラッチ・ボールを置く）
        let scratch = 0, toss = 0;
        for (const c of chart.cues) {
          if (c.beat > beat + 0.4) break;
          const d = beat - c.beat;
          if (c.type === 'scratch' && d >= 0 && d < 0.3) scratch = 1 - d / 0.3;
          if ((c.type === 'tee' || c.type === 'putt') && d > -0.35 && d < 0.2) toss = d < 0 ? 1 + d / 0.35 : 1 - d / 0.2;
        }
        mole(g, MOLE.x, MOLE.y, beat, scratch, toss);

        // ボール
        const pending = [];
        for (const c of ballCues()) {
          if (c.beat > beat + 0.35) break;
          const tg = c.target, res = st.results.get(tg);
          const d = beat - c.beat;
          if (d < 0) { // モグラから投げられて、合図の瞬間にティーに乗る
            const p = arc({ x: MOLE.x + 20, y: MOLE.y - 26 }, T, 1 + d / 0.35, 40);
            D.circ(g, p.x, p.y, 5, '#fff', '#999', 1.2);
            continue;
          }
          if (!res) { pending.push(tg); continue; }
          const e = beat - res.at;
          if (res.kind === 'perfect') {
            if (e > 1.0) continue;
            const p = arc(T, HOLE, e / 1.0, 170);
            D.circ(g, p.x, p.y, 5 - e * 2, '#fff', '#999', 1.2);
          } else if (res.kind === 'good') {
            if (e > 2) continue;
            const land = { x: HOLE.x - 26, y: HOLE.y + 2 };
            const p = e < 1 ? arc(T, land, e, 150) : { x: land.x + 12 * U.ease.outCubic(U.prog(e, 1, 1.6)), y: land.y };
            g.globalAlpha = 1 - U.prog(e, 1.6, 2); D.circ(g, p.x, p.y, 4, '#fff', '#999', 1.2); g.globalAlpha = 1;
          } else if (res.tapped) { // スライスして池へ
            if (e > 1.6) continue;
            if (e < 0.7) { const p = arc(T, POND, e / 0.7, 90); D.circ(g, p.x, p.y, 5, '#fff', '#999', 1.2); }
            else { const k = U.prog(e, 0.7, 1.6); g.globalAlpha = 1 - k; D.ell(g, POND.x, POND.y, 10 + 40 * k, 3 + 10 * k, null, '#ffffff', 3); D.text(g, 'ポチャン', POND.x, POND.y - 26 - 10 * k, 14, '#ffffff', '#1d5a90'); g.globalAlpha = 1; }
          } else { // 押し忘れ：ボールが転がっていく
            if (e > 0.8) continue;
            g.globalAlpha = 1 - e / 0.8; D.circ(g, T.x - 40 * e, T.y, 5, '#fff', '#999', 1.2); g.globalAlpha = 1;
          }
        }
        pending.forEach((tg, j) => {
          D.line(g, T.x - j * 14, T.y + 5, T.x - j * 14, T.y + 10, '#ffc93a', 3);
          D.circ(g, T.x - j * 14, T.y, 5, '#fff', '#999', 1.2);
        });

        // スイング：次の対象に向けて振りかぶり、タップで振り抜く
        const dTap = beat - st.lastTap;
        let club;
        let nt = null; for (const tg of pending) { nt = tg; break; }
        if (dTap >= 0 && dTap < 0.15) club = U.lerp(2.3, -2.2, U.ease.inCubic(dTap / 0.15));          // 振り抜く
        else if (dTap >= 0.15 && dTap < 1.0) club = U.lerp(-2.2, 0.1, U.ease.inOutSine(U.prog(dTap, 0.6, 1.0))); // フィニッシュ → 戻す
        else if (nt) club = U.lerp(0.1, 2.3, U.ease.inOutSine(U.prog(beat, nt.beat - 1, nt.beat - 0.15)));      // 振りかぶる
        else club = 0.1 + Math.sin(beat * Math.PI) * 0.05;
        const dMiss = beat - st.lastMiss, dHit = beat - st.lastHit;
        const mood = fin !== null ? 'happy' : dMiss >= 0 && dMiss < 1 ? 'confused' : dHit >= 0 && dHit < 0.7 ? 'happy' : 'normal';
        flamingo(g, 104, 330, beat, club, mood, combo >= 10 || fin !== null);
        if (mood === 'confused') D.text(g, '?', 150, 222, 26, '#ffffff', '#2b1640');
        if (dp >= 1 && dp < 1.9) { const s = U.ease.outBack(U.prog(dp, 1, 1.25)); g.save(); g.translate(250, 240); g.scale(s, s); g.rotate(-0.08); D.text(g, 'ナイスイン！', 0, 0, 22, '#ffe28a', '#2b1640'); g.restore(); }

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 120); g.scale(s, s); g.rotate(-0.06);
          D.text(g, 'ホールアウト！', 0, 0, 34, '#ffe28a', '#2b1640');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    const bands = ['#5a1f63', '#a8246e', '#e8483a', '#ff7a1a', '#ffc23a'];
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, h * i / 8, w, h / 8 + 1); });
    g.fillStyle = '#3cbf7c'; g.fillRect(0, h * 5 / 8, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.save(); g.translate(40, 64); g.scale(0.42, 0.42); flamingo(g, 0, 0, t * 2, Math.sin(t * 3) * 1.2, 'happy', true); g.restore();
    D.line(g, 84, 76, 84, 50, '#eee', 1.5); g.beginPath(); g.moveTo(84, 50); g.lineTo(96, 55); g.lineTo(84, 60); g.fillStyle = '#ff3d6e'; g.fill();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.golf = {
    id: 'golf', title: 'グルーヴ・ゴルフ', color: '#ff7a1a', sport: true, level: 4,
    howto: 'コトッ・シュッ→次の拍、キュッ・キュッ→裏拍、コトコトコト→3連打',
    bpm: 112, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: { tee: { id: 'tee', gain: 2.2 }, waggle: { id: 'waggle', gain: 2.4 }, scratch: { id: 'scratch', gain: 1.8 }, putt: { id: 'rim', gain: 1.6 }, fin: [{ id: 'cheer', gain: 0.8 }, { id: 'boom', gain: 0.6 }] },
    missSound: 'whiff',
    anchors: { golfer: { x: 124, y: 234 }, mole: { x: 50, y: 340 }, crowd: { x: 270, y: 270 } },
    quips: {
      miss: [{ id: 'voice:boss:ファー！', say: 'ファー！', who: 'golfer' }, { id: 'voice:robo:アチャー', say: 'アチャー', who: 'mole' }],
      combo: [{ id: 'voice:crowd:ナイスショット！', say: 'ナイスショット！', who: 'crowd' }, { id: 'voice:boss:グルーヴィ！', say: 'グルーヴィ！', who: 'golfer' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
