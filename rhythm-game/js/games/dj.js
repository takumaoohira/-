/*
 * ミニゲーム⑬「フロア爆上げDJ」（音ハメ）
 *   ビルドアップ（ゴーッと上がる音＋スネアの連打＋「スリー・ツー・ワン」）のあと、次の小節の頭でタップ → ドロップ！
 *   DJのシンセ「ジャ・ジャ・ジャン」には、同じリズムで答える（コール＆レスポンス）。
 *   ハードには「フェイク」：ビルドアップのあと「マダダヨ〜」で落とさない。押したら負け。
 */
(function () {
  const { U, D } = RG;
  const patterns = {
    D: { len: 8, cues: [{ b: 0, type: 'build' }], inputs: [{ b: 4, type: 'drop' }] },
    S: { len: 4, cues: [0, 0.5, 1.5].map(b => ({ b, type: 'call' })), inputs: [2, 2.5, 3.5].map(b => ({ b, type: 'stab' })) },
    S2: { len: 4, cues: [0, 1, 1.5].map(b => ({ b, type: 'call' })), inputs: [2, 3, 3.5].map(b => ({ b, type: 'stab' })) },
    F: { len: 8, cues: [{ b: 0, type: 'build' }, { b: 4, type: 'fake' }], inputs: [], activeAlways: true, active: [3.7, 7.6] },
    G: { len: 4, cues: [], inputs: [] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'フロア爆上げDJ、スタート！' },
    { p: 'G', sec: 'I', guide: '「スリー・ツー・ワン」の次で、ドロップ！' },
    ...seq('D G S S G S', 'A'),
    ...seq('D S2 S S2 D', 'B', 'ジャ・ジャ・ジャンには同じリズムで答える'),
    ...seq('S S2 D S S2 D', 'C', 'フロア最高潮！'),
    { p: 'fin', sec: 'end', guide: 'オールナイト！' }
  ];
  const hard = {
    bpm: 136,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 朝までノンストップ' },
      { p: 'G', sec: 'I', guide: '「マダダヨ〜」はフェイク。落とすな！' },
      ...seq('D S S2 F S', 'A'),
      ...seq('S2 S D F S2 S', 'B', 'フェイクに注意！'),
      ...seq('D S2 S F D S2 D', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'オールナイト！' }
    ]
  };
  const lessons = [
    { p: 'D', title: 'ドロップ', hint: 'スリー・ツー・ワン → 次の頭でドロップ' },
    { p: 'S', title: 'ジャ・ジャ・ジャン', hint: '同じリズムで答える（頭・裏・2拍目の裏）' },
    { p: 'S2', title: 'ジャン・ジャ・ジャン', hint: '頭・2拍目・その裏' },
    { p: 'F', title: 'フェイク（ハード用）', hint: '「マダダヨ〜」→ 押さない' }
  ];

  const PROG = { A: ['Fm9', 'C#maj7', 'G#maj7', 'D#9'], B: ['C#maj7', 'D#9', 'Fm9', 'Cm7'], C: ['Fm9', 'D#9', 'C#maj7', 'Cm7'], P: ['Fm9', 'C#maj7'], I: ['D#9'], count: ['Fm9'], end: ['Fm9'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec, spb = chart.spb;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'kick2', gain: 0.45 }));
    if (sec === 'end') return RG.Band.ending('Fm9', 0.8).concat([{ b: 0, id: 'bassdrop', gain: 0.35 }]);
    const ch = RG.Band.chord(info.chord);
    // ビルドアップの小節：キックが抜けて、ストリングスがのびる
    if ((info.p === 'D' || info.p === 'F') && info.pbar === 0) return [{ b: 0, id: 'kick2', gain: 0.5 }, { b: 0, id: `str:${ch.notes.join(',')}:${(spb * 4).toFixed(1)}`, gain: 0.35, rev: 0.4 }];
    // フェイクのあとの小節は、ほぼ無音（「…」）
    if (info.p === 'F' && info.pbar === 1) return [{ b: 0, id: 'hh2', gain: 0.1 }, { b: 2, id: 'hh2', gain: 0.1 }];
    const ev = RG.Band.bar(info, chart, { style: 'edm', chord: info.chord, drums: 0.9, comp: 0.8, bass: 0.9, clearCues: true, pad: info.p === 'D' ? 0.25 : 0 });
    return ev;
  }
  const stabOf = (chart, beat, up = 0) => { const bar = chart.barAt(beat), ch = RG.Band.chord((bar && bar.chord) || 'Fm9'); return `stab:${ch.notes.slice(0, 4).map(n => n.replace(/(-?\d)$/, d => +d + up)).join(',')}:0.25`; };
  function hitSounds(tg, kind, chart) {
    const s = tg.type === 'drop'
      ? [{ id: 'bassdrop', gain: 1 }, { id: 'crash', gain: 0.6 }, { id: stabOf(chart, tg.beat), gain: 0.7 }, { id: 'voice:crowd:イェーイ！', gain: 0.55, bus: 'voice' }]
      : [{ id: stabOf(chart, tg.beat, 1), gain: 0.75 }, { id: 'clap', gain: 0.35 }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.3 });
    return s;
  }
  function preload(chart) {
    const ids = ['bassdrop', 'crash', 'clap', 'sparkle', 'scratch', 'voice:crowd:イェーイ！'];
    Object.values(PROG).flat().forEach(c => { const ch = RG.Band.chord(c); [0, 1].forEach(up => ids.push(`stab:${ch.notes.slice(0, 4).map(n => n.replace(/(-?\d)$/, d => +d + up)).join(',')}:0.25`)); });
    return ids;
  }
  const cueSounds = {
    // ビルドアップ：上がっていくノイズ＋8分→16分のスネア＋DJのカウント
    build: (cue, chart) => {
      const s = [{ id: `rise:x:${(chart.spb * 4).toFixed(2)}`, gain: 1.0 }];
      [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75].forEach((d, i) => s.push({ id: 'snare2', d, gain: 0.3 + i * 0.035 }));
      s.push({ id: 'voice:boss:スリー', d: 1, gain: 1.4, say: 'スリー', who: 'dj', len: 0.8 }, { id: 'voice:boss:ツー', d: 2, gain: 1.4, say: 'ツー', who: 'dj', len: 0.8 }, { id: 'voice:boss:ワン！', d: 3, gain: 1.25, say: 'ワン！', who: 'dj', len: 0.8 });
      return s;
    },
    call: (cue, chart) => ({ id: stabOf(chart, cue.beat), gain: 1.0 }),
    fake: { id: 'voice:boss:マダダヨ〜', gain: 1.4, say: 'マダダヨ〜♪', who: 'dj', len: 1.6 },
    fin: [{ id: 'voice:crowd:アンコール！', gain: 1, bus: 'voice', say: 'アンコール！', who: 'crowd', d: 1 }, { id: 'cheer', gain: 0.8 }]
  };

  // ---------------- 描画 ----------------
  function djCat(g, x, y, beat, scratch, hype) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - U.hop(beat) * (hype ? 8 : 3));
    D.rrect(g, -26, 0, 52, 44, 12, '#2b2b3a', ink, 2.5);
    D.circ(g, 0, -20, 24, '#f0b060', ink, 2.5);
    g.beginPath(); g.moveTo(-20, -30); g.lineTo(-14, -52); g.lineTo(-4, -40); g.moveTo(20, -30); g.lineTo(14, -52); g.lineTo(4, -40); g.fillStyle = '#f0b060'; g.fill(); g.stroke();
    g.beginPath(); g.arc(0, -22, 27, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 5; g.strokeStyle = '#ff3d8b'; g.stroke();
    D.rrect(g, -32, -30, 10, 18, 4, '#ff3d8b', ink, 2); D.rrect(g, 22, -30, 10, 18, 4, '#ff3d8b', ink, 2);
    D.shades(g, 0, -22, 9, 6, '#1fc7b6');
    D.mouth(g, 0, -8, 5, hype ? 'open' : 'smile');
    const ang = scratch ? Math.sin(beat * 40) * 0.3 : hype ? -2.6 : 0.3;
    g.save(); g.translate(22, 6); g.rotate(ang); D.line(g, 0, 0, 0, 26, ink, 9); D.line(g, 0, 0, 0, 26, '#2b2b3a', 6); D.circ(g, 0, 28, 6, '#f0b060', ink, 2); g.restore();
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastDrop: -99, lastStab: -99, lastExtra: -99, n: 0 };
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        if (kind === 'miss') st.lastMiss = at;
        else if (tg.type === 'drop') st.lastDrop = at; else { st.lastStab = at; st.n++; }
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat, r) { st.lastTap = vbeat; if (r && r.kind === 'extra') st.lastExtra = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const combo = session.judge.s.combo;
        const inst = chart.instanceAt(beat);
        const build = inst && (inst.p === 'D' || inst.p === 'F') && beat - inst.start < 4 ? (beat - inst.start) / 4 : null;
        const dd = beat - st.lastDrop, hype = (dd >= 0 && dd < 4) || fin !== null;
        // クラブ：LEDの壁
        g.fillStyle = '#0d0618'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        const pulse = 1 - (((beat % 1) + 1) % 1);
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
          const on = (r * 3 + c + Math.floor(beat)) % 5 === 0;
          g.fillStyle = on ? `rgba(${hype ? '255,61,139' : '90,60,160'},${0.15 + 0.25 * pulse})` : 'rgba(60,40,90,.15)';
          g.fillRect(12 + c * 38, 40 + r * 30, 32, 24);
        }
        // ドロップ後のレーザー（ゆっくり動く線。強い点滅はしない）
        if (hype) {
          g.save(); g.globalAlpha = 0.35 * (fin !== null ? 1 : 1 - U.prog(dd, 3, 4));
          for (let k = 0; k < 6; k++) { const a = Math.sin(beat * 0.7 + k) * 0.7; D.line(g, 180, 210, 180 + Math.sin(a + k * 0.5 - 1.2) * 400, 210 + Math.cos(a + k * 0.5 - 1.2) * 400, ['#1fc7b6', '#ff3d8b', '#ffc23a'][k % 3], 3); }
          g.restore();
        }
        // ビルドアップのメーター（満タンの瞬間がドロップ）
        if (build !== null) {
          D.rrect(g, 70, 70, 220, 22, 11, '#1a0b26', '#ffffff', 2.5);
          D.rrect(g, 73, 73, Math.max(1, 214 * build), 16, 8, build > 0.75 ? '#ff3d8b' : '#ffc23a');
          D.text(g, inst.p === 'F' && build > 0.95 ? '…？' : 'BUILD UP', 180, 58, 14, '#ffffff', '#1a0b26');
        }
        if (dd >= 0 && dd < 1.2) { const s = U.ease.outBack(U.prog(dd, 0, 0.25)); g.save(); g.translate(180, 140); g.scale(s, s); g.rotate(-0.06); D.text(g, 'DROP!!', 0, 0, 44, '#ffc23a', '#1a0b26'); g.restore(); }
        // DJブース
        let scratching = false; for (const c of chart.cues) { if (c.beat > beat) break; if (c.type === 'call' && beat - c.beat < 0.3) scratching = true; }
        djCat(g, 180, 250, beat, scratching, hype);
        D.rrect(g, 90, 290, 180, 50, 10, '#2a2a3a', '#000', 3);
        [130, 230].forEach((x, i) => { D.ell(g, x, 304, 30, 9, '#111', '#555', 2); g.save(); g.translate(x, 304); g.scale(1, 0.3); g.rotate(beat * 3 + i); D.line(g, 0, 0, 26, 0, '#ff3d8b', 4); g.restore(); });
        // イコライザー（答えのジャンでぴょんと伸びる）
        const ds = beat - st.lastStab;
        for (let k = 0; k < 10; k++) {
          const h = 8 + 18 * Math.abs(Math.sin(beat * Math.PI + k)) * (hype ? 1.6 : 0.8) + (ds >= 0 && ds < 0.4 ? 30 * (1 - ds / 0.4) * (0.5 + 0.5 * Math.sin(k * 2)) : 0);
          D.rrect(g, 100 + k * 16, 336 - h, 10, h, 3, k % 2 ? '#1fc7b6' : '#ff3d8b');
        }
        // フロアの観客
        for (let i = 0; i < 10; i++) {
          const x = 14 + i * 37, jump = hype ? Math.abs(Math.sin((beat + i * 0.13) * Math.PI)) * 20 : U.hop(beat + (i % 2) * 0.5) * 4;
          const y = 470 - jump;
          D.circ(g, x, y, 14, '#1d1030'); D.ell(g, x, y + 46, 20, 34, '#1d1030');
          if (hype) { D.line(g, x - 10, y + 22, x - 18, y - 14, '#1d1030', 6); D.line(g, x + 10, y + 22, x + 18, y - 14, '#1d1030', 6); }
        }
        if (beat - st.lastMiss < 1.2 && beat - st.lastMiss >= 0) D.text(g, 'シーン…', 180, 400, 18, '#888', '#000');
        if (beat - st.lastExtra < 1.2 && beat - st.lastExtra >= 0) D.text(g, 'ガクッ', 180, 400, 18, '#fff', '#000');
        if (hype) for (let k = 0; k < 14; k++) { const x = (k * 53 + beat * 80) % 360, y = 380 + ((k * 37 + beat * 140) % 160); D.rrect(g, x, y - 200, 5, 9, 2, ['#ffc23a', '#ff3d8b', '#1fc7b6'][k % 3]); }
        if (fin !== null) { const s = U.ease.outBack(U.prog(fin, 0, 0.4)); g.save(); g.translate(180, 140); g.scale(s, s); g.rotate(-0.06); D.text(g, 'オールナイト！', 0, 0, 32, '#ffc23a', '#1a0b26'); g.restore(); }
        if (combo >= 10 && !hype) D.text(g, 'フロア温まってきた！', 180, 380, 13, '#1fc7b6', null, 'center', 800);
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#0d0618'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    for (let k = 0; k < 8; k++) { const hh = 6 + 18 * Math.abs(Math.sin(t * 4 + k)); D.rrect(g, 10 + k * 10, 92 - hh, 7, hh, 2, k % 2 ? '#1fc7b6' : '#ff3d8b'); }
    g.save(); g.translate(50, 52); g.scale(0.6, 0.6); djCat(g, 0, 0, t * 2, false, Math.sin(t * 2) > 0); g.restore();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.dj = {
    id: 'dj', title: 'フロア爆上げDJ', color: '#ff3d8b', group: 'beat', level: 3,
    howto: '「スリー・ツー・ワン」の次の頭でドロップ！ DJの「ジャ・ジャ・ジャン」には同じリズムで答える',
    bpm: 128, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds, missSound: 'scratch',
    anchors: { dj: { x: 214, y: 214 }, crowd: { x: 180, y: 420 } },
    quips: {
      miss: [{ id: 'voice:boss:オット！', say: 'おっと！', who: 'dj' }, { id: 'voice:crowd:エ〜？', say: 'え〜？', who: 'crowd' }],
      extra: [{ id: 'voice:boss:マダダヨ', say: 'まだだよ', who: 'dj' }],
      combo: [{ id: 'voice:crowd:フゥー！', say: 'フゥー！', who: 'crowd' }, { id: 'voice:boss:アゲテケ！', say: 'アゲてけ！', who: 'dj' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
