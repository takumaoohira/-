/*
 * ミニゲーム⑭「しめの一音ピアノ」（音ハメ）
 *   ピアノ猫が音階を上っていく。最後の「ド（主音）」を弾くのがきみの役目。
 *   音階のリズムが続いた「次のマス」で弾くと、和音がきれいに解決する（ソ・シ・レ・ファ → ド・ミ・ソ）。
 *     4分音符で3つ（ソ・ラ・シ）       → 1拍あと
 *     8分音符で7つ（ド〜シ）            → 半拍あと
 *     3連符で3つ（ソ・ラ・シ）          → 3連符の次（2拍目の頭）
 *     付点で4つ（ファ・ソ・ラ・シ）（ハード）→ 付点の次（3拍目の頭）
 */
(function () {
  const { U, D } = RG;
  const KEYS = {
    C: { scale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'], tonic: 'C5', V: 'G7', I: 'C' },
    F: { scale: ['F4', 'G4', 'A4', 'A#4', 'C5', 'D5', 'E5'], tonic: 'F5', V: 'C7', I: 'F' },
    G: { scale: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5'], tonic: 'G5', V: 'D7', I: 'G' },
    D: { scale: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5'], tonic: 'D5', V: 'A7', I: 'D' }
  };
  const down = n => n.replace(/(-?\d)$/, d => +d - 1);
  const RUNS = {
    Q: { at: [0, 1, 2], deg: [4, 5, 6], ans: 3 },
    E: { at: [0, 0.5, 1, 1.5, 2, 2.5, 3], deg: [0, 1, 2, 3, 4, 5, 6], ans: 3.5 },
    T: { at: [0, 2 / 3, 4 / 3], deg: [4, 5, 6], ans: 2 },
    D: { at: [0, 0.75, 1.5, 2.25], deg: [3, 4, 5, 6], ans: 3 }
  };
  const patterns = {};
  Object.entries(RUNS).forEach(([r, R]) => Object.entries(KEYS).forEach(([k, K]) => {
    patterns[`${r}_${k}`] = {
      len: 4, key: k, run: r,
      cues: R.at.map((b, i) => ({
        b, type: 'note', data: { note: K.scale[R.deg[i]], key: k },
        snd: [{ id: `piano:${K.scale[R.deg[i]]}:0.7`, gain: 1.15, pan: 0.15 }].concat(i === 0 ? RG.Band.chord(K.V).notes.map(n => ({ id: `piano:${down(n)}:1.6`, gain: 0.5, pan: -0.1 })) : [])
      })),
      inputs: [{ b: R.ans, type: 'tonic', data: { key: k, note: K.tonic } }]
    };
  }));
  patterns.fin = { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] };

  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: 'しめの一音ピアノ、開演です' },
    { p: 'rest', sec: 'I', guide: 'ソ・ラ・シ… の次に「ド」！（1拍あと）' },
    ...seq('Q_C Q_F Q_G Q_C Q_D Q_C', 'A'),
    { p: 'rest', sec: 'I', guide: '速い8分の音階は、半拍あとに「ド」' },
    ...seq('E_C Q_F E_G E_D Q_C E_F', 'B'),
    { p: 'rest', sec: 'I', guide: '3連符は、3連符の次のマスで' },
    ...seq('T_C E_F T_G Q_D T_F E_C T_G E_C', 'C'),
    { p: 'fin', sec: 'end', guide: 'ブラボー！' }
  ];
  const hard = {
    bpm: 108,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ アンコール・リサイタル' },
      { p: 'rest', sec: 'I', guide: '付点の音階（タッ・タ・タッ）も来るよ' },
      ...seq('Q_C E_F T_G D_D E_C T_F', 'A'),
      ...seq('D_G E_D T_C D_F Q_G E_C', 'B', '転調だらけ！'),
      ...seq('T_D D_C E_G T_F D_D E_C T_G D_C', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: 'ブラボー！' }
    ]
  };
  const lessons = [
    { p: 'Q_C', title: '4分の音階', hint: 'ソ・ラ・シ → 1拍あとに「ド」' },
    { p: 'E_C', title: '8分の音階', hint: 'ド〜シ（速い）→ 半拍あとに「ド」' },
    { p: 'T_C', title: '3連符の音階', hint: 'ソ・ラ・シ（3連）→ 次のマスで「ド」' },
    { p: 'D_C', title: '付点の音階（ハード用）', hint: 'タッ・タ・タッ・タ → 次の頭で「ド」' }
  ];

  function chordFor() { return null; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.2 }));
    if (sec === 'end') return RG.Band.ending('Cmaj7').concat(['C3', 'G3', 'C4', 'E4', 'G4', 'C5'].map((n, k) => ({ b: k * 0.08, id: `piano:${n}:2.5`, gain: 0.6, rev: 0.4 })));
    const pat = chart.game.patterns[info.p];
    const K = KEYS[(pat && pat.key) || 'C'];
    // 小節の和音は「V7」（最後の一音で I に解決する）。休みの小節はおだやかに
    return RG.Band.bar(info, chart, { style: 'ballad', chord: pat && pat.key ? K.V : 'Cmaj7', drums: 0.55, comp: 0, bass: 0.75, pad: 0.4, clearCues: true });
  }
  function hitSounds(tg, kind) {
    const K = KEYS[(tg.data && tg.data.key) || 'C'];
    const s = [{ id: `piano:${K.tonic}:1.8`, gain: 1.25, pan: 0.15 }]
      .concat(RG.Band.chord(K.I).notes.map(n => ({ id: `piano:${down(n)}:1.8`, gain: 0.55, pan: -0.1 })))
      .concat([{ id: `str:${RG.Band.chord(K.I).notes.join(',')}:1.4`, gain: 0.35 }]);
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.25 });
    return s;
  }
  function preload() {
    const ids = ['kazoo', 'sparkle'];
    Object.values(KEYS).forEach(K => { ids.push(`piano:${K.tonic}:1.8`, `str:${RG.Band.chord(K.I).notes.join(',')}:1.4`); RG.Band.chord(K.I).notes.forEach(n => ids.push(`piano:${down(n)}:1.8`)); });
    return ids;
  }

  // ---------------- 描画 ----------------
  // 鍵盤：C4〜C6（白鍵15）
  const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const KX0 = 12, KW = 336 / 15, KY = 392, KH = 96;
  function keyRect(note) {
    const m = /^([A-G])(#?)(\d)$/.exec(note); if (!m) return null;
    const wi = WHITE.indexOf(m[1]) + (+m[3] - 4) * 7;
    if (wi < 0 || wi > 14) return null;
    if (!m[2]) return { x: KX0 + wi * KW, y: KY, w: KW, h: KH, black: false };
    return { x: KX0 + (wi + 1) * KW - KW * 0.3, y: KY, w: KW * 0.6, h: KH * 0.6, black: true };
  }
  function pianoCat(g, x, y, beat, play, mood) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y + Math.sin(beat * Math.PI) * 2);
    D.rrect(g, -22, 0, 44, 50, 12, '#1a1a24', ink, 2.5); // えんび服
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, 22); g.lineTo(6, 0); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(-8, 4); g.lineTo(0, 8); g.lineTo(8, 4); g.lineTo(8, 12); g.lineTo(0, 8); g.lineTo(-8, 12); g.closePath(); g.fillStyle = '#c2185b'; g.fill(); // 蝶ネクタイ
    D.circ(g, 0, -20, 22, '#e8e8f0', ink, 2.5);
    g.beginPath(); g.moveTo(-18, -30); g.lineTo(-12, -50); g.lineTo(-2, -38); g.moveTo(18, -30); g.lineTo(12, -50); g.lineTo(2, -38); g.fillStyle = '#e8e8f0'; g.fill(); g.stroke();
    D.eyes(g, 0, -22, 8, 3.5, mood === 'happy' ? 'happy' : mood === 'shock' ? 'wide' : 'closed');
    D.mouth(g, 0, -10, 4, mood === 'shock' ? 'o' : 'smile');
    [-1, 1].forEach(s => { g.save(); g.translate(s * 20, 10); g.rotate(-s * 0.6 + (play ? Math.sin(beat * 30 + s) * 0.25 : 0)); D.line(g, 0, 0, 0, 30, ink, 9); D.line(g, 0, 0, 0, 30, '#1a1a24', 6); D.circ(g, 0, 32, 6, '#e8e8f0', ink, 2); g.restore(); });
    g.restore();
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { lastTap: -99, lastMiss: -99, lastHit: -99, results: new Map() };
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
        // ホール
        const grd = g.createLinearGradient(0, view.y0, 0, view.y1); grd.addColorStop(0, '#1a0e24'); grd.addColorStop(1, '#3a1830');
        g.fillStyle = grd; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#7a1a2a'; for (let k = -1; k < 10; k++) { g.beginPath(); g.moveTo(k * 40, view.y0); g.quadraticCurveTo(k * 40 + 20, 60, k * 40 + 40, view.y0); g.fill(); } // 幕
        const dh = beat - st.lastHit;
        g.save(); g.globalAlpha = 0.18 + (dh >= 0 && dh < 1 ? 0.25 * (1 - dh) : 0) + (fin !== null ? 0.2 : 0);
        g.beginPath(); g.moveTo(170, 40); g.lineTo(80, 370); g.lineTo(280, 370); g.lineTo(190, 40); g.fillStyle = '#fff2c0'; g.fill(); g.restore(); // スポットライト
        // グランドピアノ（横から）
        g.fillStyle = '#0c0c12'; g.beginPath(); g.moveTo(60, 300); g.lineTo(60, 262); g.quadraticCurveTo(150, 200, 300, 236); g.lineTo(310, 300); g.closePath(); g.fill();
        D.line(g, 120, 236, 230, 150, '#0c0c12', 4); // ふた
        D.line(g, 80, 300, 80, 360, '#0c0c12', 7); D.line(g, 290, 300, 290, 360, '#0c0c12', 7);
        let playing = false; for (const c of chart.cues) { if (c.beat > beat) break; if (c.type === 'note' && beat - c.beat < 0.5) playing = true; }
        const dm = beat - st.lastMiss;
        pianoCat(g, 100, 228, beat, playing, fin !== null || (dh >= 0 && dh < 1) ? 'happy' : dm >= 0 && dm < 1 ? 'shock' : 'normal');
        // 音符が舞う
        for (const c of chart.cues) { if (c.beat > beat) break; const d = beat - c.beat; if (c.type === 'note' && d < 1.2) { g.globalAlpha = 1 - d / 1.2; D.note(g, 150 + (c.beat * 37 % 100), 200 - d * 60, 0.9, '#ffe066'); g.globalAlpha = 1; } }
        if (dh >= 0 && dh < 1.2) { g.globalAlpha = 1 - dh / 1.2; D.note(g, 250, 190 - dh * 70, 1.6, '#ffc23a'); D.note(g, 215, 210 - dh * 50, 1.2, '#ff3d8b'); g.globalAlpha = 1; }

        // 鍵盤
        D.rrect(g, KX0 - 6, KY - 14, 348, KH + 22, 6, '#2a1408', '#000', 3);
        const lit = new Map();
        for (const c of chart.cues) { if (c.beat > beat + 0.01) break; if (c.type === 'note' && beat - c.beat < 0.35) lit.set(c.data.note, '#ff9fd0'); }
        const inst = chart.instanceAt(beat);
        let pendingKey = null;
        if (inst && inst.targets.length) { const tg = inst.targets[0], r = st.results.get(tg); if (!r) pendingKey = tg.data.note; else if (r.kind !== 'miss' && beat - r.at < 0.8) lit.set(tg.data.note, '#ffc23a'); }
        const draw = black => {
          for (let o = 4; o <= 6; o++) for (const w of WHITE) for (const sh of black ? ['#'] : ['']) {
            if (o === 6 && w !== 'C') continue;
            if (black && (w === 'E' || w === 'B' || o === 6)) continue;
            const n = w + sh + o, r = keyRect(n); if (!r) continue;
            const col = lit.get(n) || (black ? '#111' : '#f8f4ea');
            D.rrect(g, r.x + 1, r.y, r.w - 2, r.h, 3, col, '#333', 1.5);
            if (n === pendingKey) { g.save(); g.globalAlpha = 0.5 + 0.5 * Math.sin(beat * Math.PI * 4); D.rrect(g, r.x + 1, r.y, r.w - 2, r.h, 3, null, '#ffc23a', 3.5); g.restore(); D.star(g, r.x + r.w / 2, r.y + r.h - 16, 6, 2.5, 5, 0, '#ffc23a'); }
          }
        };
        draw(false); draw(true);
        // きみの指（タップで鍵盤を押す）
        const dt = beat - st.lastTap;
        const tk = pendingKey || (inst && inst.targets[0] && inst.targets[0].data.note) || 'C5';
        const kr = keyRect(tk) || keyRect('C5');
        const press = dt >= 0 && dt < 0.2 ? 1 - dt / 0.2 : 0;
        g.save(); g.translate(kr.x + kr.w / 2, kr.y - 30 + press * 26);
        D.rrect(g, -9, -40, 18, 46, 8, '#ffcfa8', '#1a0b26', 2.5); D.rrect(g, -14, -60, 28, 24, 8, '#f4f4f4', '#1a0b26', 2);
        g.restore();
        D.text(g, 'YOU', kr.x + kr.w / 2, KY - 106 + press * 26, 10, '#ffe066', '#1a0b26');
        if (dm >= 0 && dm < 0.8) D.text(g, 'ぷぅ？', 250, 360, 16, '#fff', '#1a0b26');
        // 客席
        for (let i = 0; i < 10; i++) { const x = 16 + i * 37, up = (fin !== null || (dh >= 0 && dh < 0.6)) ? 6 * Math.abs(Math.sin(beat * Math.PI * 2 + i)) : 0; D.circ(g, x, 512 - up, 13, '#0c0612'); }
        if (combo >= 10) D.text(g, 'マエストロ！', 300, 120, 15, '#ffc23a', '#1a0b26');
        if (fin !== null) { const s = U.ease.outBack(U.prog(fin, 0, 0.4)); g.save(); g.translate(180, 120); g.scale(s, s); g.rotate(-0.05); D.text(g, 'ブラボー！', 0, 0, 36, '#ffc23a', '#1a0b26'); g.restore(); }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#1a0e24'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    for (let k = 0; k < 8; k++) D.rrect(g, 4 + k * 11.5, 62, 11, 34, 2, (Math.floor(t * 4) % 8) === k ? '#ffc23a' : '#f8f4ea', '#333', 1);
    [1, 2, 4, 5, 6].forEach(k => D.rrect(g, 4 + k * 11.5 - 3.5, 62, 7, 20, 1, '#111'));
    D.note(g, 40, 40 - Math.abs(Math.sin(t * 3)) * 8, 1.5, '#ffc23a'); D.note(g, 64, 30, 1.1, '#ff3d8b');
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.piano = {
    id: 'piano', title: 'しめの一音ピアノ', color: '#ffc23a', group: 'beat', level: 2,
    howto: '音階の最後の「ド」を弾く。4分→1拍あと、8分→半拍あと、3連符→次の3連のマス',
    bpm: 96, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: { fin: [{ id: 'cheer', gain: 0.9 }, { id: 'voice:crowd:ブラボー！', gain: 1, bus: 'voice', say: 'ブラボー！', who: 'crowd', d: 0.5 }] },
    missSound: 'kazoo',
    anchors: { cat: { x: 110, y: 186 }, crowd: { x: 180, y: 480 } },
    quips: {
      miss: [{ id: 'voice:lady:アラ？', say: 'あら？', who: 'cat' }, { id: 'voice:lady:オシイ', say: 'おしい', who: 'cat' }],
      combo: [{ id: 'voice:crowd:ブラボー！', say: 'ブラボー！', who: 'crowd' }, { id: 'voice:lady:ステキ！', say: 'ステキ！', who: 'cat' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
