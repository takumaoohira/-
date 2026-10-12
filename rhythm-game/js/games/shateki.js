/*
 * ミニゲーム⑫「夏祭り射的」
 *   コルク銃で、まん中の照準に来た的を撃つ。
 *     アヒル「クワッ」     → 左から泳いできて、2拍あとに照準へ
 *     カン「カンッ」       → 棚の上に飛び出して、1拍あと
 *     風船「プ・プ・プ」   → 半拍ずつ3つ浮かんできて、2拍あとから半拍ずつ3回
 *     おじさん「ウツナヨ〜」→ 撃たない！（撃つと余分な入力）
 */
(function () {
  const { U, D } = RG;
  const patterns = {
    D: { len: 4, cues: [{ b: 0, type: 'duck', for: 0 }], inputs: [{ b: 2, type: 'duck' }] },
    C: { len: 4, cues: [{ b: 0, type: 'can', for: 0 }, { b: 2, type: 'can', for: 1 }], inputs: [{ b: 1, type: 'can' }, { b: 3, type: 'can' }] },
    B: { len: 4, cues: [0, 0.5, 1].map((b, i) => ({ b, type: 'balloon', for: i })), inputs: [2, 2.5, 3].map(b => ({ b, type: 'balloon' })) },
    X: { len: 4, cues: [{ b: 0, type: 'oji' }], inputs: [], activeAlways: true, active: [0.4, 3.8] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: '夏祭り射的、いらっしゃい！' },
    { p: 'rest', sec: 'I', guide: 'アヒル「クワッ」の2拍あと、照準に来たら撃つ' },
    ...seq('D D D D D D', 'A'),
    { p: 'rest', sec: 'I', guide: 'カン「カンッ」は1拍あと、風船は3つ' },
    ...seq('C D B C D B', 'B'),
    { p: 'rest', sec: 'I', guide: 'おじさんが出たら撃っちゃダメ！' },
    ...seq('B C X D B X C B', 'C'),
    { p: 'fin', sec: 'end', guide: '大当たり〜！' }
  ];
  const hard = {
    bpm: 124,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 閉店まぎわ' },
      { p: 'rest', sec: 'I', guide: 'アヒル=2拍あと／カン=1拍あと／風船=3つ／おじさん=撃たない' },
      ...seq('D C B X C B', 'A'),
      ...seq('B X C B D X', 'B', 'おじさんに注意！'),
      ...seq('C B X C B X B C D', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '大当たり〜！' }
    ]
  };
  const lessons = [
    { p: 'D', title: 'アヒル', hint: '「クワッ」→ 2拍あとに撃つ' },
    { p: 'C', title: 'カン', hint: '「カンッ」→ 1拍あと（2回）' },
    { p: 'B', title: '風船', hint: 'プ・プ・プ → 2拍あとから半拍ずつ3回' },
    { p: 'X', title: 'おじさん', hint: '「ウツナヨ〜」→ 撃たない' }
  ];

  const PROG = { A: ['Dm', 'Dm', 'C', 'Am'], B: ['A#', 'C', 'Dm', 'Am'], C: ['Dm', 'C', 'A#', 'A7'], P: ['Dm', 'Am'], I: ['A7'], count: ['Dm'], end: ['Dm'] };
  const FUE = { A: ['D5 - F5 - G5 - A5 -', 'C6 - A5 - G5 - - -', 'G5 - A5 - C6 - D6 -', 'A5 - - - - - . .'], B: ['F5 - G5 - A5 - - -', 'G5 - E5 - C5 - - -', 'D5 - F5 - A5 - D6 -', 'C6 - A5 - - - . .'], C: ['D6 - C6 - A5 - G5 -', 'A5 - - - G5 - E5 -', 'F5 - G5 - A5 - C6 -', 'A5 - - - E5 - - -'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: b === 3 ? 'tom:C2' : 'rim', gain: 0.5 }));
    if (sec === 'end') return RG.Band.ending('Dm').concat([{ b: 0, id: 'tom:C2', gain: 0.8 }, { b: 0, id: 'flute:D6:1.2', gain: 0.5, rev: 0.4 }]);
    if (info.p === 'X') return [{ b: 0, id: 'tom:C2', gain: 0.5 }, { b: 2, id: 'rim', gain: 0.3 }];
    return RG.Band.bar(info, chart, { style: 'matsuri', chord: info.chord, drums: 0.85, comp: 0.8, bass: 0.8, clearCues: true, mel: FUE[sec] ? FUE[sec][info.secBar % 4] : null, melInst: 'flute', melGain: 0.42, melPan: 0.2 });
  }
  function hitSounds(tg, kind) {
    const s = [{ id: 'cork', gain: 0.8 }, { id: tg.type === 'balloon' ? 'pop' : 'clank', gain: tg.type === 'balloon' ? 0.8 : 0.5 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.35 });
    return s;
  }
  function preload() { return ['cork', 'pop', 'clank', 'sparkle', 'whiff', 'tom:C2', 'rim']; }

  // ---------------- 描画 ----------------
  const AIM = { x: 180, y: 268 };
  function duckToy(g, x, y, s, rot) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    D.ell(g, 0, 6, 22, 14, '#ffd23a', ink, 2.5); D.circ(g, 12, -10, 11, '#ffd23a', ink, 2.5);
    g.beginPath(); g.moveTo(20, -10); g.lineTo(32, -7); g.lineTo(20, -4); g.closePath(); g.fillStyle = '#ff7a1a'; g.fill(); g.stroke();
    D.circ(g, 14, -13, 2.5, ink);
    g.restore();
  }
  function can(g, x, y, s, rot) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    D.rrect(g, -12, -18, 24, 36, 4, '#d8d8e8', ink, 2.5); D.rrect(g, -12, -6, 24, 12, 0, '#ff3d6e');
    D.text(g, '★', 0, 0, 10, '#fff');
    g.restore();
  }
  function balloon(g, x, y, c) {
    const ink = '#1a0b26';
    D.line(g, x, y + 16, x + Math.sin(y * 0.1) * 4, y + 40, '#ddd', 1.5);
    D.ell(g, x, y, 13, 16, c, ink, 2); D.ell(g, x - 4, y - 6, 3, 5, 'rgba(255,255,255,.6)');
  }
  function oji(g, x, y, k, mood) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y);
    D.rrect(g, -30, 10, 60, 60, 14, '#3d7bd9', ink, 3); // はっぴ
    D.line(g, -10, 10, 10, 70, '#fff', 3);
    D.circ(g, 0, -14, 26, '#ffcfa8', ink, 3);
    D.rrect(g, -28, -36, 56, 10, 5, '#fff', ink, 2); // はちまき
    D.eyes(g, 0, -16, 10, 3.5, mood === 'hurt' ? 'x' : mood === 'happy' ? 'happy' : 'normal');
    D.mouth(g, 0, -2, 8, mood === 'hurt' ? 'o' : 'smile');
    if (mood === 'hurt') D.circ(g, 14, -30, 6, '#ff7a8a');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastHit: -99, lastExtra: -99, results: new Map() };
    const cols = ['#ff3d8b', '#1fc7b6', '#ffc23a'];
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at; else st.lastHit = at;
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat, r) { st.lastTap = vbeat; if (r && r.kind === 'extra') st.lastExtra = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 夜祭りの屋台
        g.fillStyle = '#1a1030'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        for (let k = 0; k < 7; k++) { const x = 20 + k * 54; D.line(g, x, view.y0, x, 14, '#333', 1); D.ell(g, x, 26, 10, 13, '#ff4a3a', '#7a1a10', 1.5); D.text(g, '祭', x, 26, 9, '#fff'); } // ちょうちん
        D.rrect(g, 10, 40, 340, 360, 6, '#5a3418', '#2a1408', 4);
        for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#e8322a'; g.fillRect(10 + k * 34, 40, 34, 34); }
        D.text(g, '射 的', 180, 96, 26, '#ffc23a', '#2a1408');
        // 景品の棚
        D.rrect(g, 30, 150, 300, 10, 3, '#8a5a32', '#2a1408', 2); D.rrect(g, 30, 214, 300, 10, 3, '#8a5a32', '#2a1408', 2);
        [[60, 132, '#ff9fb8'], [110, 136, '#8fd3ff'], [250, 134, '#c8e88a'], [300, 132, '#ffd36b']].forEach(([x, y, c]) => { D.circ(g, x, y, 14, c, '#2a1408', 2); D.circ(g, x - 9, y - 12, 5, c, '#2a1408', 1.5); D.circ(g, x + 9, y - 12, 5, c, '#2a1408', 1.5); });
        // アヒルの水路
        D.rrect(g, 30, 284, 300, 24, 8, '#2a5aa8', '#102a58', 2);
        for (let k = 0; k < 8; k++) D.line(g, 40 + k * 38 + (beat * 10) % 38, 296, 56 + k * 38 + (beat * 10) % 38, 296, '#7ab0ff', 2);

        // 的
        for (const c of chart.cues) {
          if (c.beat > beat + 0.01) break;
          if (c.type === 'oji') {
            const d = beat - c.beat;
            if (d < 3.8) {
              const up = U.ease.outBack(U.prog(d, 0, 0.3)) * (1 - U.prog(d, 3.4, 3.8));
              const hurt = beat - st.lastExtra < 1.2 && st.lastExtra >= c.beat;
              oji(g, AIM.x, 300 - 70 * up, d, hurt ? 'hurt' : 'happy');
              if (hurt) D.text(g, 'イテッ', AIM.x + 50, 210, 18, '#fff', '#1a0b26');
            }
            continue;
          }
          if (!c.target) continue;
          const tg = c.target, r = st.results.get(tg);
          const span = tg.beat - c.beat;
          if (r && r.kind !== 'miss') { // 撃たれた：倒れて消える
            const e = beat - r.at; if (e > 0.6) continue;
            if (tg.type === 'balloon') { if (e < 0.2) D.star(g, AIM.x + (tg.k - 1) * 40, AIM.y - 20, 18 * (1 - e / 0.2) + 4, 6, 8, 0, cols[tg.k % 3]); continue; }
            const x = tg.type === 'duck' ? AIM.x : AIM.x, y = tg.type === 'can' ? 196 : 284;
            if (tg.type === 'duck') duckToy(g, x, y + e * 40, 1.2, e * 5); else can(g, x, y - Math.sin(Math.PI * e / 0.6) * 40, 1.2, e * 8);
            continue;
          }
          const u = (beat - c.beat) / span;
          if (tg.type === 'duck') { if (u > 1.6) continue; duckToy(g, U.lerp(-20, AIM.x, u), 282 - Math.abs(Math.sin(beat * Math.PI * 2)) * 3, 1.2, 0); }
          else if (tg.type === 'can') { if (u > 1.5) continue; const up = U.ease.outBack(U.prog(u, 0, 0.35)) * (1 - U.prog(u, 1.2, 1.5)); can(g, AIM.x, 214 - 24 * up, up, 0); }
          else if (tg.type === 'balloon') { if (u > 1.4) continue; balloon(g, AIM.x + (tg.k - 1) * 40, U.lerp(420, AIM.y - 20, U.ease.outCubic(Math.min(1, u))) - (u > 1 ? (u - 1) * 120 : 0), cols[tg.k % 3]); }
        }
        // 照準
        g.save(); g.globalAlpha = 0.85;
        D.circ(g, AIM.x, AIM.y, 26, null, '#ff3d3d', 3); D.line(g, AIM.x - 36, AIM.y, AIM.x - 14, AIM.y, '#ff3d3d', 3); D.line(g, AIM.x + 14, AIM.y, AIM.x + 36, AIM.y, '#ff3d3d', 3);
        D.line(g, AIM.x, AIM.y - 36, AIM.x, AIM.y - 14, '#ff3d3d', 3); D.line(g, AIM.x, AIM.y + 14, AIM.x, AIM.y + 36, '#ff3d3d', 3);
        g.restore();

        // コルク銃（手前）とコルク
        const dt = beat - st.lastTap;
        const kick = dt >= 0 && dt < 0.25 ? 1 - dt / 0.25 : 0;
        if (dt >= 0 && dt < 0.15) { const u = dt / 0.15; D.circ(g, U.lerp(180, AIM.x, u), U.lerp(440, AIM.y, u), 6 - 3 * u, '#c98a4b', '#5a3418', 1.5); }
        g.save(); g.translate(180, 470 + kick * 10);
        D.rrect(g, -10, -70, 20, 80, 6, '#8a5a32', '#2a1408', 3); D.rrect(g, -6, -84, 12, 20, 3, '#555', '#000', 2);
        D.circ(g, -22, 4, 14, '#ffcfa8', '#1a0b26', 2.5); D.circ(g, 22, -14, 14, '#ffcfa8', '#1a0b26', 2.5);
        g.restore();
        D.rrect(g, 120, 506, 120, 30, 10, '#e8322a', '#1a0b26', 2.5); D.text(g, 'YOU', 180, 521, 12, '#fff');
        // 屋台のおじさん（ミスすると笑う）
        const dm = beat - st.lastMiss;
        if (dm >= 0 && dm < 1.2) { g.save(); g.translate(318, 372); g.scale(0.6, 0.6); oji(g, 0, 0, 0, 'happy'); g.restore(); }
        if (combo >= 10) D.text(g, '名人！', 300, 470, 18, '#ffc23a', '#1a0b26');

        if (fin !== null) {
          for (let k = 0; k < 6; k++) { const a = k / 6 * D.TAU + fin; D.star(g, 180 + Math.cos(a) * 90 * U.prog(fin, 0, 0.5), 200 + Math.sin(a) * 60 * U.prog(fin, 0, 0.5), 8, 3, 5, fin, cols[k % 3]); }
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 200); g.scale(s, s); g.rotate(-0.06);
          D.text(g, '大当たり〜！', 0, 0, 34, '#ffc23a', '#2a1408');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#1a1030'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#fff' : '#e8322a'; g.fillRect(k * 20, 0, 20, 18); }
    D.rrect(g, 6, 66, 88, 10, 3, '#2a5aa8');
    duckToy(g, 20 + ((t * 25) % 60), 64, 0.7, 0);
    D.circ(g, 50, 46, 14, null, '#ff3d3d', 2.5); D.line(g, 50, 26, 50, 38, '#ff3d3d', 2); D.line(g, 50, 54, 50, 66, '#ff3d3d', 2);
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.shateki = {
    id: 'shateki', title: '夏祭り射的', color: '#e8322a', group: 'action', level: 3,
    howto: '照準に来た的を撃つ。アヒル「クワッ」→2拍あと、カン→1拍あと、風船→3つ、おじさん→撃たない',
    bpm: 112, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      duck: { id: 'voice:duck:クワッ', gain: 1.4 },
      can: { id: 'ka', gain: 1.1 },
      balloon: { id: 'pok', gain: 1.3 },
      oji: { id: 'voice:uncle:ウツナヨ〜', gain: 1.4, say: 'ウツナヨ〜', who: 'oji', len: 1.4 },
      fin: [{ id: 'voice:uncle:オオアタリ〜！', gain: 1.1, bus: 'voice', say: '大当たり〜！', who: 'oji' }, { id: 'cheer', gain: 0.7 }]
    },
    missSound: 'whiff',
    anchors: { oji: { x: 230, y: 190 }, crowd: { x: 180, y: 430 } },
    quips: {
      miss: [{ id: 'voice:uncle:オシイ！', say: 'おしい！', who: 'oji' }, { id: 'voice:uncle:ハズレ〜', say: 'はずれ〜', who: 'oji' }],
      extra: [{ id: 'voice:uncle:イテッ！ウツナッテ！', say: 'いてっ！撃つなって！', who: 'oji' }],
      combo: [{ id: 'voice:uncle:アタリ〜！', say: 'アタリ〜！', who: 'oji' }, { id: 'voice:crowd:スゴーイ！', say: 'すごーい！', who: 'crowd' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
