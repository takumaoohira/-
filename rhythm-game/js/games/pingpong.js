/*
 * ミニゲーム④「ピンポン・ファンク」（スポーツ・むずかしめ）
 *   相手（アフロ・ゴリラ）の打球の種類で、打ち返すまでの長さが変わる。どれも途中で台に1回はねる「ポッ」が入る。
 *     コン（ふつう）   → 1拍あとに打つ   （コン・ポッ・カン）
 *     パシッ（スマッシュ）→ 半拍あとに打つ   （パシッ・ポ・カン）
 *     ポワーン（ロブ）  → 2拍あとに打つ   （ポワーン・・ポッ・・カン）
 */
(function () {
  const { U, D, Music: M } = RG;
  const DUR = { pong: 1, smash: 0.5, lob: 2 };

  // [打球の種類, 相手が打つ拍] の並びからパターンを作る
  function rally(shots, len = 4) {
    const cues = [], inputs = [];
    shots.forEach(([k, a], i) => {
      cues.push({ b: a, type: k, for: i }, { b: a + DUR[k] / 2, type: 'pok' });
      inputs.push({ b: a + DUR[k], type: k });
    });
    cues.sort((x, y) => x.b - y.b);
    return { len, cues, inputs };
  }
  const patterns = {
    N: rally([['pong', 0], ['pong', 2]]),
    N1: rally([['pong', 0]]),
    S: rally([['pong', 0], ['smash', 2]]),
    L: rally([['lob', 0]]),
    SN: rally([['smash', 0], ['pong', 1.5]]),
    O: rally([['pong', 0.5], ['pong', 2.5]]),             // 裏拍ラリー
    SS: rally([['smash', 0], ['smash', 1], ['pong', 2]]),   // スマッシュ連打
    LS: rally([['lob', 0], ['smash', 2.5]]),              // ロブ→すぐスマッシュ
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };

  const seq = (s, sec, first, guides = {}) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : guides[i] || null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'ピンポン・ファンク、開始！' },
    { p: 'rest', sec: 'I', guide: 'コン・ポッ・カン！（相手が打った1拍あと）' },
    ...seq('N N N1 N N N', 'A'),
    { p: 'rest', sec: 'I', guide: '「パシッ」はスマッシュ。半拍あとに打ち返せ！' },
    ...seq('S N S N1 L N', 'B', null, { 4: '「ポワーン」はロブ。2拍待って打つ' }),
    ...seq('S L N S L S N S', 'C', 'ぜんぶまぜるよ！'),
    { p: 'fin', sec: 'end', guide: 'ゲームセット！' }
  ];
  const hard = {
    bpm: 126,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 本気のゴリラ' },
      { p: 'rest', sec: 'I', guide: 'コン=1拍 / パシッ=半拍 / ポワーン=2拍' },
      ...seq('N S O S L SN', 'A'),
      ...seq('SS O LS SS O N', 'B', '裏拍ラリー＆スマッシュ連打！'),
      ...seq('SS LS O SS SN LS O SS', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'ゲームセット！' }
    ]
  };
  const lessons = [
    { p: 'N', title: 'ふつうの打球', hint: 'コン・ポッ・カン（1拍あと）' },
    { p: 'S', title: 'スマッシュ', hint: '2球目の「パシッ」は半拍あと！' },
    { p: 'L', title: 'ロブ', hint: 'ポワーン・・ポッ・・カン（2拍あと）' },
    { p: 'O', title: '裏拍ラリー（ハード用）', hint: '拍の「裏」から始まるラリー' }
  ];

  // ---- 曲（Eマイナーのファンク） ----
  const CH = {
    Em7: { root: 'E', notes: ['G3', 'B3', 'D4'] }, A7: { root: 'A', notes: ['G3', 'C#4', 'E4'] },
    Cmaj7: { root: 'C', notes: ['E3', 'G3', 'B3'] }, B7: { root: 'B', notes: ['A3', 'D#4', 'F#4'] }
  };
  const PROG = { A: ['Em7', 'Em7', 'A7', 'A7'], B: ['Cmaj7', 'B7', 'Em7', 'A7'], C: ['Em7', 'A7', 'Cmaj7', 'B7'], P: ['Em7', 'A7'], I: ['B7'], count: ['Em7'], end: ['Em7'] };
  // ベースの型：[拍, 半音, 長さ]
  const RIFF = [[0, 0, 0.3], [0.75, 12, 0.15], [1.5, 0, 0.2], [2.5, 10, 0.2], [3, 7, 0.2], [3.5, 12, 0.15]];
  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const tr = (root, oct, semi) => { const i = NOTE_ORDER.indexOf(root) + semi; return NOTE_ORDER[((i % 12) + 12) % 12] + (oct + Math.floor(i / 12)); };

  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const ch = CH[info.chord] || CH.Em7, sec = info.sec, ev = [];
    if (sec === 'count') return [{ b: 0, id: 'ohat', gain: 0.3 }, { b: 2, id: 'ohat', gain: 0.3 }];
    if (sec === 'end') {
      ev.push({ b: 0, id: 'brass:E4,G4,B4,D5:0.9', gain: 1 }, { b: 0, id: `sbass:E2:1.2`, gain: 1 }, { b: 0, id: 'kick', gain: 1 }, { b: 0, id: 'clap', gain: 0.8 });
      return ev;
    }
    ev.push(...M.rhythm('x.....x...x.....', 'kick', 0.42));
    ev.push(...M.rhythm('....x.......x...', 'clap', 0.34));
    ev.push(...M.rhythm('o.o.o.o.o.o.o.o.', 'hat', 0.28));
    ev.push(...M.rhythm('..............x.', 'ohat', 0.3));
    RIFF.forEach(([b, s, d]) => ev.push({ b, id: `sbass:${tr(ch.root, 2, s)}:${d}`, gain: 0.48 }));
    [1.75, 3.75].forEach(b => ch.notes.slice(1).forEach(n => ev.push({ b, id: `clav:${n}:0.2`, gain: 0.32 })));
    if (info.secBar % 4 === 0 && sec !== 'I' && sec !== 'P') ev.push({ b: 0, id: `brass:${ch.notes.map(n => tr(n.replace(/\d$/, ''), 4, 0)).join(',')}:0.25`, gain: 0.5 });
    return ev;
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat);
    const ch = CH[bar && bar.chord] || CH.Em7;
    const s = [{ id: 'pingHit', gain: 1 }, { id: `clav:${tr(ch.notes[tg.k % 3].replace(/\d$/, ''), 5, 0)}:0.2`, gain: 0.45 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.4 });
    return s;
  }
  function preload() {
    const ids = ['pingHit', 'sparkle', 'miss', 'pong', 'pok', 'smash', 'lob', 'cheer'];
    Object.values(CH).forEach(c => c.notes.forEach(n => ids.push(`clav:${tr(n.replace(/\d$/, ''), 5, 0)}:0.2`)));
    return ids;
  }
  // 相手が打つのは、こちらが打ち返してから半拍以上あと（返球が届く時間）
  function validate(chart) {
    const out = [];
    const hits = chart.cues.filter(c => c.target);
    for (let i = 1; i < hits.length; i++) {
      const prev = hits[i - 1].target;
      if (hits[i].beat < prev.beat + 0.5) out.push(`返球が間に合いません: ${prev.beat}拍で打って ${hits[i].beat}拍に相手が打つ`);
    }
    return out;
  }

  // ---------------- 描画 ----------------
  const O = { x: 78, y: 292 }, OS = { x: 74, y: 236 }, B = { x: 240, y: 330 }, P = { x: 290, y: 296 }, B2 = { x: 116, y: 330 };
  const H = { pong: [44, 34], smash: [-6, 18], lob: [150, 60] };
  const arc = (a, b, u, h) => ({ x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u) - Math.sin(Math.PI * U.clamp(u, 0, 1)) * h });

  function gorilla(g, x, y, beat, swing, kind, mood) {
    g.save(); g.translate(x, y - U.hop(beat) * 3);
    // 体
    g.beginPath(); g.moveTo(-34, 60); g.bezierCurveTo(-46, -10, -30, -40, 0, -40); g.bezierCurveTo(30, -40, 46, -10, 34, 60); g.closePath();
    g.fillStyle = '#3a2e3f'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#140c18'; g.stroke();
    D.ell(g, 0, 20, 20, 26, '#6e5a66');
    // 金のチェーン
    g.beginPath(); g.arc(0, -14, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 3.5; g.strokeStyle = '#ffc93a'; g.stroke();
    D.circ(g, 0, 7, 5, '#ffc93a', '#a07800', 1.5);
    // 頭とアフロ
    for (let k = 0; k < 9; k++) D.circ(g, Math.cos(k / 9 * D.TAU) * 26, -62 + Math.sin(k / 9 * D.TAU) * 16, 15, '#1d1420');
    D.circ(g, 0, -56, 26, '#3a2e3f', '#140c18', 3);
    D.ell(g, 0, -46, 17, 13, '#8a7480');
    D.rrect(g, -27, -74, 54, 8, 3, '#ff3d6e'); // ヘッドバンド
    if (mood === 'wide') D.eyes(g, 0, -58, 10, 4, 'wide'); else D.shades(g, 0, -58, 10, 7, '#2b1640');
    D.mouth(g, 0, -42, 6, mood === 'happy' ? 'open' : mood === 'wide' ? 'o' : 'smile');
    // 腕とラケット
    const ang = kind === 'lob' ? 1.6 - swing * 2.2 : kind === 'smash' ? -1.4 + swing * 2.6 : -0.6 + swing * 1.8;
    g.save(); g.translate(28, -6); g.rotate(ang);
    D.line(g, 0, 0, 0, 40, '#140c18', 14); D.line(g, 0, 0, 0, 40, '#3a2e3f', 9);
    D.line(g, 0, 40, 0, 54, '#8a5a32', 5); D.ell(g, 0, 66, 13, 15, '#e0313a', '#5a0a10', 2.5);
    g.restore();
    g.restore();
  }
  function duck(g, x, y, beat, swing, mood, cool, spin) {
    g.save(); g.translate(x, y - U.hop(beat) * 3); g.rotate(spin);
    D.ell(g, -10, 64, 12, 5, '#ff9f2e'); D.ell(g, 12, 64, 12, 5, '#ff9f2e');
    D.ell(g, 0, 22, 30, 40, '#fff6d8', '#5a4a20', 3);
    // リーゼント
    g.beginPath(); g.moveTo(-22, -34); g.bezierCurveTo(-30, -78, 30, -92, 34, -66); g.bezierCurveTo(20, -70, 6, -60, 10, -40); g.closePath();
    g.fillStyle = '#1d1420'; g.fill();
    g.globalAlpha = 0.5; D.line(g, -10, -62, 18, -76, '#8a7aff', 2); g.globalAlpha = 1;
    D.circ(g, 0, -24, 24, '#fff6d8', '#5a4a20', 3);
    if (mood === 'dizzy') D.eyes(g, -6, -28, 8, 4, 'dizzy');
    else if (cool) D.shades(g, -6, -28, 9, 6);
    else D.eyes(g, -6, -28, 8, 4, mood === 'happy' ? 'happy' : 'normal', -1);
    g.beginPath(); g.moveTo(-28, -18); g.quadraticCurveTo(-46, -14, -28, -8); g.quadraticCurveTo(-20, -12, -28, -18); g.fillStyle = '#ff9f2e'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#a05a10'; g.stroke();
    // 腕とラケット（打つと前へ振る）
    const ang = -1.0 + swing * 2.0;
    g.save(); g.translate(-18, 6); g.rotate(-ang);
    D.line(g, 0, 0, -26, 6, '#5a4a20', 9); D.line(g, 0, 0, -26, 6, '#fff6d8', 6);
    D.line(g, -26, 6, -36, 8, '#8a5a32', 5); D.ell(g, -48, 10, 12, 14, '#202030', '#000', 2.5);
    g.restore();
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastHit: -99, lastMiss: -99, results: new Map(), perfect: -99 };
    const hitCues = () => chart.cues.filter(c => c.target);
    let cache = null, cacheLen = -1;
    function cuesList() { if (cacheLen !== chart.cues.length) { cache = hitCues(); cacheLen = chart.cues.length; } return cache; }

    function ballState(beat) {
      const list = cuesList();
      let idx = -1;
      for (let i = 0; i < list.length; i++) { if (list[i].beat <= beat + 1e-6) idx = i; else break; }
      if (idx < 0) return null;
      const c = list[idx], tg = c.target, k = c.type, d = DUR[k], next = list[idx + 1];
      const res = st.results.get(tg);
      const from = k === 'smash' ? OS : O;
      const hb = res && res.kind !== 'miss' ? res.at : null;
      if (hb === null || beat < hb) {
        if (res && res.kind === 'miss' && beat >= res.at) {
          const u = U.prog(beat, res.at, res.at + 0.7);
          if (u >= 1) return null;
          return { x: U.lerp(P.x, 400, u), y: U.lerp(P.y, 520, u * u), k, trail: 0 };
        }
        const t0 = c.beat, tb = t0 + d / 2, t1 = t0 + d;
        if (beat < tb) return Object.assign(arc(from, B, (beat - t0) / (tb - t0), H[k][0]), { k, trail: 1 });
        const u = (beat - tb) / (t1 - tb);
        return Object.assign(arc(B, P, Math.min(u, 1.35), H[k][1]), { k, trail: 1 });
      }
      // 打ち返したあと：次の打球の時刻に相手のところへ届く
      const ret = next && next.beat - hb < 1.6 ? next.beat - hb : 1;
      const u = (beat - hb) / ret;
      if (u >= 1) return null;
      if (u < 0.5) return Object.assign(arc(P, B2, u * 2, 40), { k: 'ret', trail: 0.6 });
      return Object.assign(arc(B2, next && next.type === 'smash' && next.beat - hb < 1.6 ? OS : O, (u - 0.5) * 2, next && next.type === 'lob' ? 10 : 34), { k: 'ret', trail: 0.6 });
    }

    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at; else { st.lastHit = at; if (kind === 'perfect') st.perfect = at; }
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 背景：ファンクな体育館
        const grd = g.createLinearGradient(0, view.y0, 0, view.y1);
        grd.addColorStop(0, '#22102f'); grd.addColorStop(1, '#4d1a57');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.save(); g.translate(180, 40); g.rotate(beat * 0.05);
        for (let k = 0; k < 12; k++) { g.rotate(D.TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, 700); g.lineTo(40, 700); g.closePath(); g.fillStyle = k % 2 ? 'rgba(255,122,26,.08)' : 'rgba(255,61,139,.06)'; g.fill(); }
        g.restore();
        // ミラーボール
        D.line(g, 180, view.y0, 180, 34, '#888', 2);
        D.circ(g, 180, 50, 18, '#c8c8d8', '#6a6a80', 2);
        for (let k = 0; k < 6; k++) { const a = beat * 0.8 + k; D.rrect(g, 172 + Math.cos(a) * 9, 44 + (k % 3) * 5, 5, 4, 1, k % 2 ? '#ffffff' : '#9aa0c0'); }
        // 観客
        for (let i = 0; i < 9; i++) {
          const x = 10 + i * 42, up = (combo >= 10 || fin !== null ? 10 : 4) * U.hop(beat + (i % 2) * 0.5);
          D.circ(g, x, 450 - up, 15, '#170a20'); D.ell(g, x, 500 - up, 22, 36, '#170a20');
          if (combo >= 10 && i % 3 === 1) { D.rrect(g, x - 16, 408 - up, 32, 18, 3, '#ffc93a'); D.text(g, 'FUNK', x, 417 - up, 9, '#2b1640'); }
        }
        // 台
        g.fillStyle = '#103a35'; g.fillRect(70, 346, 8, 60); g.fillRect(282, 346, 8, 60);
        D.rrect(g, 46, 330, 268, 16, 4, '#1fae94', '#0b4a40', 3);
        D.line(g, 50, 332, 310, 332, '#ffffff', 2);
        D.line(g, 180, 314, 180, 332, '#ffffff', 3); D.line(g, 176, 314, 184, 314, '#ffffff', 3);

        // 相手のスイング
        let oSwing = 0, oKind = 'pong';
        for (const c of cuesList()) {
          if (c.beat > beat + 0.5) break;
          const d = beat - c.beat;
          if (d > -0.35 && d < 0.4) { oKind = c.type; oSwing = d < 0 ? 0 : 1 - Math.min(1, d / 0.4); if (d < 0) oSwing = -0.3 * U.prog(d, -0.35, 0); }
        }
        const smashJump = oKind === 'smash' && oSwing > 0 ? 26 * oSwing : 0;
        const dMiss = beat - st.lastMiss, dHit = beat - st.lastHit;
        gorilla(g, 42, 290 - smashJump, beat, Math.max(0, oSwing), oKind, fin !== null ? 'happy' : dMiss >= 0 && dMiss < 1 ? 'happy' : combo >= 10 ? 'wide' : 'normal');
        if (smashJump > 4) for (let k = 0; k < 3; k++) D.line(g, 6 + k * 14, 340 - k * 4, 2 + k * 14, 360 - k * 4, 'rgba(255,200,80,.7)', 3);

        // ボール
        const bs = ballState(beat);
        if (bs) {
          if (bs.k === 'smash') { for (let k = 1; k <= 4; k++) { g.globalAlpha = 0.5 / k; D.circ(g, bs.x - k * 7, bs.y - k * 5, 7 - k, '#ff7a1a'); } g.globalAlpha = 1; }
          if (bs.k === 'lob') { for (let k = 1; k <= 3; k++) D.star(g, bs.x - k * 9, bs.y + k * 6, 3, 1.2, 4, beat, 'rgba(255,240,150,.8)'); }
          D.circ(g, bs.x, bs.y, 6, '#ffffff', '#c0a070', 1.5);
          D.ell(g, bs.x, 336, 5, 1.6, 'rgba(0,0,0,.25)');
        }

        // こちら（リーゼント・ダック）
        const dTap = beat - st.lastTap;
        const swing = dTap >= 0 && dTap < 0.3 ? Math.sin(Math.PI * Math.min(1, dTap / 0.3)) : 0;
        const dizzy = dMiss >= 0 && dMiss < 1;
        duck(g, 320, 300, beat, swing, fin !== null ? 'happy' : dizzy ? 'dizzy' : dHit >= 0 && dHit < 0.6 ? 'happy' : 'normal', combo >= 10, dizzy ? Math.sin(dMiss * 12) * 0.3 * (1 - dMiss) : 0);
        const dp = beat - st.perfect;
        if (dp >= 0 && dp < 0.5) { const s = 1 - dp / 0.5; D.star(g, P.x - 14, P.y - 22, 10 * s + 4, 4, 4, dp * 4, '#ffe066'); }

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 130); g.scale(s, s); g.rotate(-0.06);
          D.text(g, 'ゲームセット！', 0, 0, 34, '#ffc93a', '#2b1640');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#22102f'); grd.addColorStop(1, '#5a1f63');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    D.rrect(g, 0, 78, 100, 8, 2, '#1fae94');
    g.save(); g.translate(62, 48); g.scale(0.55, 0.55); duck(g, 0, 0, t * 2, Math.max(0, Math.sin(t * 5)), 'happy', true, 0); g.restore();
    D.circ(g, 20, 40 - Math.abs(Math.sin(t * 4)) * 14, 4, '#fff');
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.pingpong = {
    id: 'pingpong', title: 'ピンポン・ファンク', color: '#ff3d6e', sport: true, level: 4,
    howto: 'コン→1拍あと、パシッ（スマッシュ）→半拍あと、ポワーン（ロブ）→2拍あとに打ち返す',
    bpm: 116, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: { pong: { id: 'pong', gain: 1.8 }, smash: { id: 'smash', gain: 0.9 }, lob: { id: 'lob', gain: 2.6 }, pok: { id: 'pok', gain: 1.2 }, fin: [{ id: 'cheer', gain: 0.8 }, { id: 'boom', gain: 0.6 }] },
    missSound: 'miss',
    chordFor, music, hitSounds, preload, createScene, drawIcon, validate
  };
})();
