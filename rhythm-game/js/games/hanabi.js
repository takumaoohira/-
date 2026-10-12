/*
 * ミニゲーム⑮「夜空の花火師」（音ハメ）
 *   打ち上げの「ヒュ〜」は、音が上がりきった瞬間が開く合図。そこでタップすると「ドーン！」
 *     ふつう玉「ヒュ〜」       → 2拍あと
 *     早打ち「ヒュッ」         → 1拍あと（2発）
 *     連発「ポ・ポ・ポン」     → 半拍ずつ3発、2拍あとから半拍ずつ
 *     尺玉「ヒュ〜〜〜」       → 3拍あと（でっかい）
 *     スターマイン（ハード）   → 半拍ずつ4発
 */
(function () {
  const { U, D } = RG;
  const L = (list) => ({ len: 4, cues: list.map(([b, span], i) => ({ b, type: 'launch', for: i, data: { span } })), inputs: list.map(([b, span], i) => ({ b: b + span, type: span >= 3 ? 'big' : 'fw', data: { lane: i } })) });
  const patterns = {
    N: L([[0, 2]]),
    Q: L([[0, 1], [2, 1]]),
    T: L([[0, 2], [0.5, 2], [1, 2]]),
    W: L([[0, 3]]),
    S: L([[0, 2], [0.5, 2], [1, 2], [1.5, 2]]),
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: '夜空の花火師、打ち上げ開始！' },
    { p: 'rest', sec: 'I', guide: '「ヒュ〜」が上がりきったら「ドーン」' },
    ...seq('N N N N W N', 'A'),
    { p: 'rest', sec: 'I', guide: '短い「ヒュッ」は1拍で開く' },
    ...seq('Q N Q W Q N', 'B'),
    { p: 'rest', sec: 'I', guide: '「ポ・ポ・ポン」は3連発！' },
    ...seq('T N Q T W T Q T', 'C'),
    { p: 'fin', sec: 'end', guide: '大輪の花！' }
  ];
  const hard = {
    bpm: 112,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 花火大会フィナーレ' },
      { p: 'rest', sec: 'I', guide: '4連発のスターマインも来るよ' },
      ...seq('N Q T W S Q', 'A'),
      ...seq('T S Q W T S', 'B', 'スターマイン！'),
      ...seq('S T Q S W T S S', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '大輪の花！' }
    ]
  };
  const lessons = [
    { p: 'N', title: 'ふつう玉', hint: 'ヒュ〜（2拍）→ ドーン' },
    { p: 'Q', title: '早打ち', hint: 'ヒュッ（1拍）→ ドン（2発）' },
    { p: 'T', title: '3連発', hint: 'ポ・ポ・ポン → 2拍あとから半拍ずつ' },
    { p: 'W', title: '尺玉', hint: 'ヒュ〜〜〜（3拍）→ ドドーン' },
    { p: 'S', title: 'スターマイン（ハード用）', hint: '4連発' }
  ];

  const PROG = { A: ['Fmaj7', 'Em7', 'Dm9', 'Cmaj7'], B: ['A#maj7', 'A7', 'Dm9', 'G9'], C: ['Fmaj7', 'Em7', 'A7', 'Dm9'], P: ['Fmaj7', 'Cmaj7'], I: ['G9'], count: ['Cmaj7'], end: ['Cmaj7'] };
  const MEL = { A: ['E5 - - G5 - - A5 -', 'B5 - - . A5 - G5 -', 'F5 - - A5 - - C6 -', 'B5 - - - - - . .'], C: ['A5 - - C6 - - E6 -', 'D6 - - C6 - B5 A5 -', 'C#6 - - E6 - - G6 -', 'F6 - - - - - . .'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.2 }));
    if (sec === 'end') return RG.Band.ending('Cmaj7').concat([{ b: 0, id: 'firework', gain: 0.8 }]);
    return RG.Band.bar(info, chart, { style: 'pop', chord: info.chord, drums: 0.75, comp: 0.85, bass: 0.85, pad: 0.3, clearCues: true, mel: MEL[sec] ? MEL[sec][info.secBar % 4] : null, melInst: 'ep', melGain: 0.35, melPan: -0.2 });
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat), ch = RG.Band.chord((bar && bar.chord) || 'Cmaj7');
    const s = [{ id: 'firework', gain: tg.type === 'big' ? 1.1 : 0.8 }, { id: `piano:${ch.notes[(tg.k + 2) % ch.notes.length].replace(/(-?\d)$/, d => +d + 1)}:1`, gain: 0.45 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.4 });
    return s;
  }
  function preload() {
    const ids = ['firework', 'sparkle', 'whiff', 'tom:C2'];
    Object.values(PROG).flat().forEach(c => RG.Band.chord(c).notes.forEach(n => ids.push(`piano:${n.replace(/(-?\d)$/, d => +d + 1)}:1`)));
    return ids;
  }
  const cueSounds = {
    // 「ヒュ〜」の長さ＝開くまでの時間（テンポで変わるので、ここで秒に直す）
    launch: (cue, chart) => [{ id: 'tom:C2', gain: 0.6 }, { id: `fwhistle:x:${(cue.data.span * chart.spb).toFixed(2)}`, gain: 1.7 }],
    fin: [{ id: 'voice:crowd:タマヤ〜！', gain: 1.1, bus: 'voice', say: 'たまや〜！', who: 'crowd' }, { id: 'cheer', gain: 0.6 }]
  };

  // ---------------- 描画 ----------------
  const LANES = [180, 110, 250, 70, 290];
  const COLORS = [['#ff3d8b', '#ffd0e4'], ['#ffc23a', '#fff2b0'], ['#1fc7b6', '#c0fff6'], ['#a07aff', '#e6dcff'], ['#ff7a1a', '#ffe0c0']];
  function burst(g, x, y, e, r0, col, big) {
    const n = big ? 36 : 24, R = r0 * U.ease.outCubic(Math.min(1, e / 0.5)), fade = 1 - U.prog(e, 0.6, 1.6);
    if (fade <= 0) return;
    g.save(); g.globalAlpha = fade;
    for (let k = 0; k < n; k++) {
      const a = k / n * D.TAU, droop = e * e * 10;
      const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R + droop;
      D.line(g, x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6 + droop * 0.6, px, py, col[0], big ? 3 : 2.5);
      D.circ(g, px, py, big ? 3 : 2.2, col[1]);
    }
    if (e < 0.25) D.circ(g, x, y, 14 * (1 - e / 0.25), '#ffffff');
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { results: new Map(), lastHit: -99, lastMiss: -99 };
    let cache = null, n = -1;
    const launches = () => { if (n !== chart.cues.length) { cache = chart.cues.filter(c => c.type === 'launch'); n = chart.cues.length; } return cache; };
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at; else st.lastHit = at;
      },
      onTap() {},
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        // 夜空・街・川
        const grd = g.createLinearGradient(0, view.y0, 0, 400); grd.addColorStop(0, '#05051a'); grd.addColorStop(1, '#2a1a4a');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        for (let k = 0; k < 30; k++) D.circ(g, (k * 97) % 360, ((k * 61) % 300) + view.y0 + 10, 1 + (k % 2), 'rgba(255,255,255,.5)');
        g.fillStyle = '#0a0a18';
        [[0, 360, 40, 40], [40, 340, 30, 60], [70, 370, 50, 30], [120, 330, 26, 70], [146, 355, 60, 45], [206, 320, 22, 80], [228, 350, 50, 50], [278, 335, 34, 65], [312, 362, 48, 38]].forEach(([x, y, w, h]) => { g.fillRect(x, y, w, h); for (let r = 0; r < h / 12 - 1; r++) for (let c = 0; c < w / 10 - 1; c++) if ((x + r * 3 + c) % 4 === 0) { g.fillStyle = 'rgba(255,220,140,.5)'; g.fillRect(x + 4 + c * 10, y + 6 + r * 12, 4, 5); g.fillStyle = '#0a0a18'; } });
        g.fillStyle = '#0c1430'; g.fillRect(view.x0, 400, view.x1 - view.x0, 70); // 川
        // 打ち上げ・開花
        const flashes = [];
        for (const c of launches()) {
          if (c.beat > beat + 0.01) break;
          const tg = c.target, lane = LANES[tg.data.lane % LANES.length] + ((c.beat * 37) % 3 - 1) * 14;
          const big = tg.type === 'big';
          const topY = big ? 120 : 150 + (tg.k % 3) * 20;
          const r = st.results.get(tg);
          if (r && r.kind !== 'miss') { const e = beat - r.at; if (e < 1.6) { burst(g, lane, topY, e, big ? 110 : 70, COLORS[(tg.k + Math.floor(c.beat)) % COLORS.length], big); flashes.push([lane, topY, e, big]); } continue; }
          if (r && r.kind === 'miss') { const e = beat - r.at; if (e < 0.8) { g.globalAlpha = 1 - e / 0.8; D.circ(g, lane, topY + e * 60, 3, '#888'); D.text(g, 'シュン…', lane, topY - 16, 12, '#aaa'); g.globalAlpha = 1; } continue; }
          const u = U.clamp((beat - c.beat) / (tg.beat - c.beat), 0, 1.08);
          const y = U.lerp(400, topY, U.ease.outCubic(Math.min(1, u)));
          for (let k = 1; k <= 10; k++) { g.globalAlpha = 0.8 / k; D.circ(g, lane + Math.sin(beat * 20 + k) * 2, y + k * 8, 4.5 - k * 0.3, k < 3 ? '#fff6d0' : '#ffb060'); }
          g.globalAlpha = 1; D.circ(g, lane, y, 6, '#fffbe8', '#ffc23a', 2);
          if (u > 0.85 && u <= 1) { g.globalAlpha = (u - 0.85) / 0.15; D.circ(g, lane, y, 12, null, '#ffffff', 2); g.globalAlpha = 1; } // 開く直前に光る
        }
        // 川への映り込み
        g.save(); g.globalAlpha = 0.25; flashes.forEach(([x, y, e, big]) => { if (e < 1.2) D.ell(g, x, 430, (big ? 60 : 36) * Math.min(1, e / 0.4), 6, '#ffd0e4'); }); g.restore();
        for (let k = 0; k < 10; k++) D.line(g, 10 + k * 36 + (beat * 4) % 36, 440 + (k % 3) * 8, 26 + k * 36 + (beat * 4) % 36, 440 + (k % 3) * 8, 'rgba(120,150,255,.35)', 1.5);
        // 土手と見物客（ゆかた）
        g.fillStyle = '#141c10'; g.fillRect(view.x0, 470, view.x1 - view.x0, view.y1 - 470);
        const dh = beat - st.lastHit;
        for (let i = 0; i < 9; i++) {
          const x = 22 + i * 40, up = dh >= 0 && dh < 0.6 ? 6 * (1 - dh / 0.6) : 0;
          D.circ(g, x, 488 - up, 11, '#1d1a2a'); D.ell(g, x, 520 - up, 16, 22, ['#3d5ad9', '#c2185b', '#1fc7b6'][i % 3]);
        }
        // 花火師（きみ）：打ち上げ筒のそば
        g.save(); g.translate(330, 470);
        D.rrect(g, -12, -40, 24, 40, 6, '#1a1a1a', '#000', 2); D.circ(g, 0, -52, 12, '#ffcfa8', '#000', 2); D.rrect(g, -14, -62, 28, 7, 3, '#fff'); // はちまき
        g.restore();
        D.text(g, 'YOU', 330, 500, 10, '#ffe066', '#1a0b26');
        if (combo >= 10) D.text(g, '名人芸！', 60, 380, 16, '#ffc23a', '#1a0b26');
        if (fin !== null) {
          [[90, 150], [180, 110], [270, 160]].forEach(([x, y], k) => burst(g, x, y, Math.max(0, fin - k * 0.25), 90, COLORS[k], true));
          const s = U.ease.outBack(U.prog(fin, 0, 0.4)); g.save(); g.translate(180, 300); g.scale(s, s); D.text(g, '大輪の花！', 0, 0, 34, '#ffc23a', '#1a0b26'); g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#0a0a24'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    burst(g, 50, 40, (t * 0.8) % 1.5, 32, COLORS[Math.floor(t * 0.53) % COLORS.length], true);
    g.fillStyle = '#0a0a18'; g.fillRect(0, 80, 100, 20);
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.hanabi = {
    id: 'hanabi', title: '夜空の花火師', color: '#a07aff', group: 'beat', level: 2,
    howto: '「ヒュ〜」が上がりきった瞬間に「ドーン」。長いヒュ〜は2拍、短いヒュッは1拍、ポ・ポ・ポンは3連発',
    bpm: 100, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds, missSound: 'whiff',
    anchors: { crowd: { x: 150, y: 440 } },
    quips: {
      miss: [{ id: 'voice:crowd:アァ〜', say: 'あぁ〜', who: 'crowd' }],
      combo: [{ id: 'voice:crowd:タマヤ〜！', say: 'たまや〜！', who: 'crowd' }, { id: 'voice:crowd:カギヤ〜！', say: 'かぎや〜！', who: 'crowd' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
