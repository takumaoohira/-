/*
 * ミニゲーム⑪「ロボット組み立てライン」
 *   班長ロボが部品の名前を呼ぶ。きみはクレーンで、ベルトコンベアのロボに部品を「ガシャン」と取り付ける。
 *     「アタマ！」 → 2拍あと（3拍目）
 *     「ウデ！」   → 3拍目と4拍目（左うで・右うで）
 *     「ネジ！」   → 3拍目から半拍ずつ3回（キュ・キュ・キュ）
 *     「アシ！」   → 3拍目の裏（ズン…チャッ）
 *   4つ取り付けると1台完成。ロボが歩いて出ていく。
 */
(function () {
  const { U, D } = RG;
  const P = (call, ins, type) => ({ len: 4, cues: [{ b: 0, type: call }], inputs: ins.map(b => ({ b, type })) });
  const patterns = {
    H: P('head', [2], 'head'),
    A: P('arm', [2, 3], 'arm'),
    N: P('bolt', [2, 2.5, 3], 'bolt'),
    L: P('leg', [2.5], 'leg'),
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'ロボット組み立てライン、稼働！' },
    { p: 'rest', sec: 'I', guide: '「アタマ！」の2拍あとにガシャン／「アシ！」はその裏' },
    ...seq('H L H L H L H L', 'A'),
    { p: 'rest', sec: 'I', guide: '「ウデ！」は2回、「ネジ！」は半拍ずつ3回' },
    ...seq('H A N L H A N L', 'B'),
    ...seq('A N H L N A L H', 'C', '部品の順番がバラバラに！'),
    { p: 'fin', sec: 'end', guide: '全ロボ、完成！' }
  ];
  const hard = {
    bpm: 120,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 納期ギリギリ' },
      { p: 'rest', sec: 'I', guide: 'アタマ=3拍目／ウデ=2回／ネジ=3回／アシ=裏' },
      ...seq('H A N L A N L H', 'A'),
      ...seq('N L A N H A N L', 'B', '大量生産！'),
      ...seq('A N L N A N H N', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '全ロボ、完成！' }
    ]
  };
  const lessons = [
    { p: 'H', title: 'アタマ', hint: '「アタマ！」→ 2拍あとにガシャン' },
    { p: 'L', title: 'アシ', hint: '「アシ！」→ 3拍目の裏（ズン…チャッ）' },
    { p: 'A', title: 'ウデ', hint: '「ウデ！」→ 3拍目と4拍目' },
    { p: 'N', title: 'ネジ', hint: '「ネジ！」→ 半拍ずつ3回' }
  ];

  const PROG = { A: ['Am9', 'Fmaj7', 'Cmaj7', 'G'], B: ['Dm9', 'Am9', 'Fmaj7', 'E7#9'], C: ['Am9', 'Fmaj7', 'Dm9', 'E7#9'], P: ['Am9', 'Fmaj7'], I: ['E7#9'], count: ['Am9'], end: ['Am9'] };
  const HOOK = { B: ['A5 . . C6 . . E6 .', 'D6 . C6 . A5 . . .', 'A5 . . C6 . . G6 .', 'E6 . D6 . . . . .'], C: ['E6 . E6 . D6 . C6 .', 'A5 . . . G5 . A5 .', 'F5 . A5 . D6 . F6 .', 'E6 . . . G#5 . B5 .'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'kick2', gain: 0.4 }));
    if (sec === 'end') return RG.Band.ending('Am9').concat([{ b: 0, id: 'zap', gain: 0.6 }]);
    return RG.Band.bar(info, chart, { style: 'electro', chord: info.chord, drums: 0.8, comp: 0.9, bass: 0.85, pad: sec === 'B' ? 0.25 : 0.1, clearCues: true, mel: HOOK[sec] ? HOOK[sec][info.secBar % 4] : null, melInst: 'lead', melGain: 0.28, melPan: -0.25 });
  }
  function hitSounds(tg, kind) {
    const s = tg.type === 'bolt' ? [{ id: 'drill', gain: 0.9 }] : [{ id: 'clank', gain: 0.9 }, { id: 'kick2', gain: 0.4 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.3 });
    return s;
  }
  function preload() { return ['clank', 'drill', 'kick2', 'sparkle', 'boing', 'zap']; }

  // ---------------- 描画 ----------------
  const ROBO = { x: 180, y: 336 };
  function robotParts(g, x, y, parts, beat, mood) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y);
    if (parts.leg) { [-1, 1].forEach(s => { D.rrect(g, s * 16 - 8, 30, 16, 34, 4, '#9aa4b8', ink, 2.5); D.rrect(g, s * 16 - 12, 60, 24, 10, 4, '#5a6478', ink, 2); }); }
    // 胴体（最初からある）
    D.rrect(g, -34, -30, 68, 64, 10, '#c8d0e0', ink, 3);
    D.circ(g, -12, -8, 7, '#ff3d6e', ink, 2); D.circ(g, 12, -8, 7, '#1fc7b6', ink, 2);
    for (let k = 0; k < parts.bolt; k++) { D.star(g, -18 + k * 18, 18, 5, 4, 6, 0, '#ffc23a', ink, 1.5); }
    if (parts.armL) { g.save(); g.translate(-38, -18); g.rotate(0.3 + Math.sin(beat * Math.PI) * 0.15); D.rrect(g, -9, 0, 18, 40, 8, '#9aa4b8', ink, 2.5); D.circ(g, 0, 44, 9, '#5a6478', ink, 2); g.restore(); }
    if (parts.armR) { g.save(); g.translate(38, -18); g.rotate(-0.3 - Math.sin(beat * Math.PI) * 0.15); D.rrect(g, -9, 0, 18, 40, 8, '#9aa4b8', ink, 2.5); D.circ(g, 0, 44, 9, '#5a6478', ink, 2); g.restore(); }
    if (parts.head) {
      D.rrect(g, -26, -76, 52, 42, 10, '#e0e6f0', ink, 3);
      D.line(g, 0, -76, 0, -92, ink, 2.5); D.circ(g, 0, -94, 5, Math.sin(beat * Math.PI * 2) > 0 ? '#ff3d6e' : '#ffc23a', ink, 1.5);
      const ec = mood === 'error' ? '#ff3d3d' : '#4dfcff';
      if (mood === 'happy') { D.eyes(g, 0, -56, 11, 5, 'happy'); } else { D.rrect(g, -18, -62, 12, 10, 3, ec, ink, 1.5); D.rrect(g, 6, -62, 12, 10, 3, ec, ink, 1.5); }
      D.rrect(g, -12, -46, 24, 5, 2, ink);
    }
    g.restore();
  }
  function foreman(g, x, y, beat, talk) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - U.hop(beat) * 2);
    D.rrect(g, -20, -10, 40, 50, 8, '#ffc23a', ink, 2.5);
    D.rrect(g, -22, -44, 44, 34, 8, '#ffd36b', ink, 2.5);
    D.rrect(g, -24, -52, 48, 10, 4, '#ff7a1a', ink, 2); // ヘルメット
    D.rrect(g, -14, -36, 28, 10, 3, '#1a0b26'); D.rrect(g, -10, -34, 6, 6, 1, '#4dfcff'); D.rrect(g, 4, -34, 6, 6, 1, '#4dfcff');
    D.rrect(g, -10, -22, 20, 4 + talk * 6, 2, ink);
    // メガホン
    g.save(); g.translate(22, -20); g.rotate(-0.3); g.beginPath(); g.moveTo(0, -5); g.lineTo(24, -14); g.lineTo(24, 14); g.lineTo(0, 5); g.closePath(); g.fillStyle = '#ff3d6e'; g.fill(); g.lineWidth = 2; g.strokeStyle = ink; g.stroke(); g.restore();
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastHit: -99, results: new Map() };
    const PART = { H: 'head', A: 'arm', N: 'bolt', L: 'leg' };
    // 部品のパターンだけ数えて、4つで1台
    function robotState(beat) {
      const parts = chart.instances.filter(i => PART[i.p] && !i.demo);
      const demoParts = chart.instances.filter(i => PART[i.p] && i.demo);
      const list = parts.length ? parts : demoParts;
      let idx = -1;
      for (let i = 0; i < list.length; i++) if (list[i].start <= beat) idx = i;
      if (idx < 0) return { group: 0, parts: {}, enter: 1 };
      const group = Math.floor(idx / 4), first = list[group * 4];
      const pr = { head: false, armL: false, armR: false, bolt: 0, leg: false };
      for (let i = group * 4; i <= idx; i++) {
        list[i].targets.forEach((tg, k) => {
          const r = st.results.get(tg);
          if (!r || r.kind === 'miss' || r.at > beat) return;
          if (tg.type === 'head') pr.head = true;
          if (tg.type === 'leg') pr.leg = true;
          if (tg.type === 'arm') { if (k === 0) pr.armL = true; else pr.armR = true; }
          if (tg.type === 'bolt') pr.bolt = Math.min(3, pr.bolt + 1);
        });
      }
      return { group, parts: pr, enter: U.prog(beat, first.start, first.start + 0.8), exitAt: list[group * 4 + 3] ? list[group * 4 + 3].end : null };
    }
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at; else st.lastHit = at;
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 工場
        g.fillStyle = '#16323a'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#1d4250'; for (let k = -2; k < 10; k++) g.fillRect(k * 60, view.y0, 30, 400 - view.y0);
        D.line(g, view.x0, 120, view.x1, 120, '#2b5a68', 10); D.line(g, view.x0, 140, view.x1, 140, '#2b5a68', 6); // 配管
        for (let k = 0; k < 3; k++) { D.circ(g, 300 + k * 0, 200 + k * 50, 16, '#e0e6f0', '#000', 2); D.line(g, 300, 200 + k * 50, 300 + Math.cos(beat * 2 + k) * 10, 200 + k * 50 - Math.abs(Math.sin(beat * 2 + k)) * 10, '#ff3d6e', 2); }
        // 黄黒の注意帯とベルトコンベア
        for (let k = -2; k < 20; k++) { g.fillStyle = k % 2 ? '#ffc23a' : '#1a0b26'; g.beginPath(); g.moveTo(k * 24, 396); g.lineTo(k * 24 + 12, 396); g.lineTo(k * 24 + 24, 408); g.lineTo(k * 24 + 12, 408); g.fill(); }
        D.rrect(g, view.x0 - 10, 426, view.x1 - view.x0 + 20, 26, 8, '#3a3a48', '#000', 3);
        const roll = (beat * 30) % 30;
        for (let k = -2; k < 16; k++) D.circ(g, k * 30 + roll, 439, 7, '#5a5a6a', '#000', 1.5);
        g.fillStyle = '#0f2228'; g.fillRect(view.x0, 452, view.x1 - view.x0, view.y1 - 452);

        // 組み立て中のロボ（4つで完成 → 右へ歩いて出ていく）
        const rs = robotState(beat);
        let rx = U.lerp(-80, ROBO.x, U.ease.outCubic(rs.enter));
        const done = rs.exitAt !== null && beat > rs.exitAt - 0.9;
        if (done) rx += U.ease.inCubic(U.prog(beat, rs.exitAt - 0.9, rs.exitAt)) * 280;
        const dm = beat - st.lastMiss, dh = beat - st.lastHit;
        const mood = fin !== null || done ? 'happy' : dm >= 0 && dm < 1 ? 'error' : 'normal';
        const shake = dm >= 0 && dm < 0.5 ? Math.sin(dm * 60) * 4 : 0;
        g.save(); g.translate(rx + shake, ROBO.y - (fin !== null ? Math.abs(Math.sin(fin * Math.PI * 2)) * 16 : 0)); g.scale(1.35, 1.35);
        robotParts(g, 0, 0, fin !== null ? { head: true, armL: true, armR: true, bolt: 3, leg: true } : rs.parts, beat, mood);
        g.restore();
        if (done && beat > rs.exitAt - 0.9) D.text(g, 'カンセイ！', rx, ROBO.y - 150, 18, '#ffc23a', '#1a0b26');
        if (mood === 'error') { D.text(g, 'ERROR', rx, ROBO.y - 150, 16, '#ff3d3d', '#1a0b26'); D.line(g, rx - 30, ROBO.y + 40, rx - 50, ROBO.y + 60, '#aaa', 3); }

        // クレーン（次の部品をつかんで待ち、タップでガシャン）
        D.rrect(g, view.x0, 54, view.x1 - view.x0, 12, 3, '#5a6478', '#000', 2);
        let next = null; for (const tg of chart.inputs) { if (tg.beat >= beat - 0.05 && tg.beat < beat + 3) { next = tg; break; } }
        const dt = beat - st.lastTap;
        const slam = dt >= 0 && dt < 0.1 ? dt / 0.1 : dt >= 0.1 && dt < 0.4 ? 1 - (dt - 0.1) / 0.3 : 0;
        const armY = U.lerp(150, ROBO.y - 150, U.ease.inCubic(slam));
        D.rrect(g, 166, 60, 28, 18, 4, '#ffc23a', '#000', 2);
        D.line(g, 180, 78, 180, armY, '#9aa4b8', 8);
        D.line(g, 166, armY, 194, armY, '#9aa4b8', 6); D.line(g, 166, armY, 162, armY + 18, '#9aa4b8', 5); D.line(g, 194, armY, 198, armY + 18, '#9aa4b8', 5);
        if (next && slam < 0.5) { // つかんでいる部品
          const t = next.type, yy = armY + 26;
          if (t === 'head') D.rrect(g, 160, yy - 14, 40, 30, 8, '#e0e6f0', '#000', 2);
          else if (t === 'arm') D.rrect(g, 172, yy - 16, 16, 34, 7, '#9aa4b8', '#000', 2);
          else if (t === 'leg') D.rrect(g, 172, yy - 14, 16, 30, 4, '#9aa4b8', '#000', 2);
          else D.star(g, 180, yy, 8, 6, 6, beat * 3, '#ffc23a', '#000', 1.5);
        }
        if (slam > 0.8) { D.text(g, next && next.type === 'bolt' ? 'キュイン' : 'ガシャン', 230, ROBO.y - 60, 16, '#ffffff', '#1a0b26'); }
        // 班長ロボ
        let talk = 0; for (const c of chart.cues) { if (c.beat > beat) break; if (beat - c.beat < 0.4) talk = 1 - (beat - c.beat) / 0.4; }
        foreman(g, 46, 330, beat, talk);
        if (combo >= 10) D.text(g, 'ノルマ達成ペース！', 180, 500, 13, '#4dfcff', null, 'center', 800);

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 200); g.scale(s, s); g.rotate(-0.06);
          D.text(g, '全ロボ、完成！', 0, 0, 32, '#ffc23a', '#1a0b26');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#16323a'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    g.fillStyle = '#3a3a48'; g.fillRect(0, 84, 100, 10);
    g.save(); g.translate(50, 58); g.scale(0.42, 0.42); robotParts(g, 0, 0, { head: true, armL: true, armR: true, bolt: 3, leg: true }, t * 2, Math.sin(t * 3) > 0 ? 'happy' : 'normal'); g.restore();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.robot = {
    id: 'robot', title: 'ロボット組み立てライン', color: '#4dfcff', group: 'action', level: 3,
    howto: '班長の声で部品を取り付け。「アタマ！」→2拍あと、「ウデ！」→2回、「ネジ！」→半拍ずつ3回、「アシ！」→裏',
    bpm: 108, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      head: { id: 'voice:robo:アタマ！', gain: 1.4, say: 'アタマ！', who: 'boss', len: 0.9 },
      arm: { id: 'voice:robo:ウデ！', gain: 1.4, say: 'ウデ！', who: 'boss', len: 0.9 },
      bolt: { id: 'voice:robo:ネジ！', gain: 1.4, say: 'ネジ！', who: 'boss', len: 0.9 },
      leg: { id: 'voice:robo:アシ！', gain: 1.4, say: 'アシ！', who: 'boss', len: 0.9 },
      fin: [{ id: 'voice:robo:カンセイ！', gain: 1.2, bus: 'voice', say: 'カンセイ！', who: 'boss' }, { id: 'cheer', gain: 0.6 }]
    },
    missSound: 'boing',
    anchors: { boss: { x: 60, y: 266 }, robo: { x: 180, y: 250 } },
    quips: {
      miss: [{ id: 'voice:robo:エラー！', say: 'エラー！', who: 'robo' }, { id: 'voice:robo:ガガガ', say: 'ガガガ…', who: 'robo' }],
      extra: [{ id: 'voice:robo:ブヒンガナイ', say: '部品がない', who: 'boss' }],
      combo: [{ id: 'voice:robo:カンペキ！', say: 'カンペキ！', who: 'boss' }, { id: 'voice:robo:イイネ！', say: 'イイネ！', who: 'robo' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
