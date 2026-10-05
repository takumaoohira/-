/*
 * ミニゲーム⑧「カラオケ合いの手」（音ハメ・歌）
 *   部長が歌う。歌のすきまに、きみがタンバリンで合いの手を入れる。歌い方で合いの手が決まる：
 *     4分音符で3つ歌う（ザン・ギョウ・ダ）   → 4拍目に「ハイ！」
 *     早口で3つ歌う（サケダ）                → 3拍目と4拍目に「ハイ・ハイ」
 *     ひとつの音を長〜くのばす（ヨォ〜）     → 裏拍で「ヨッ・ハッ」（3拍目の裏と4拍目の裏）
 *     2つ歌う（ソー・レ）（ハード）          → 「ハイ・ハイ・ハイ」（3拍目・その裏・4拍目）
 *   部長の歌声は合成音声（js/voice.js）です。
 */
(function () {
  const { U, D } = RG;
  const sing = (s, note, dur, b) => ({ b, type: 'sing', data: { s }, snd: [{ id: `voice:uncle:${s}:${note}:${dur}`, gain: 1.3 }] });
  const mk = (kind, syl, notes) => {
    if (kind === 'P1') return { len: 4, kind, lyric: syl, cues: syl.map((s, i) => sing(s, notes[i], 0.5, i)), inputs: [{ b: 3, type: 'aite', data: { call: 'ハイ！' } }] };
    if (kind === 'P2') return { len: 4, kind, lyric: syl, cues: syl.map((s, i) => sing(s, notes[i], 0.24, i * 0.5)), inputs: [2, 3].map(b => ({ b, type: 'aite', data: { call: 'ハイ！' } })) };
    if (kind === 'P3') return { len: 4, kind, lyric: syl, cues: [sing(syl[0], notes[0], 1.3, 0)], inputs: [{ b: 2.5, type: 'aite', data: { call: 'ヨッ！' } }, { b: 3.5, type: 'aite', data: { call: 'ハッ！' } }] };
    return { len: 4, kind, lyric: syl, cues: syl.map((s, i) => sing(s, notes[i], 0.5, i)), inputs: [2, 2.5, 3].map(b => ({ b, type: 'aite', data: { call: 'ハイ' } })) };
  };
  const patterns = {
    P1a: mk('P1', ['ザン', 'ギョウ', 'ダ'], ['A3', 'C4', 'E4']),
    P1b: mk('P1', ['カ', 'ラ', 'オケ'], ['E4', 'D4', 'C4']),
    P1c: mk('P1', ['ボー', 'ナス', 'ハ'], ['C4', 'D4', 'E4']),
    P1d: mk('P1', ['シャ', 'チョウ', 'ノ'], ['A3', 'B3', 'C4']),
    P1e: mk('P1', ['ア', 'シタ', 'モ'], ['E4', 'E4', 'A4']),
    P1f: mk('P1', ['ノミ', 'カイ', 'ダ'], ['G4', 'E4', 'D4']),
    P2a: mk('P2', ['サ', 'ケ', 'ダ'], ['E4', 'E4', 'A4']),
    P2b: mk('P2', ['ヨ', 'イ', 'ショ'], ['A3', 'C4', 'E4']),
    P2c: mk('P2', ['ハ', 'ナ', 'ミ'], ['D4', 'E4', 'G4']),
    P2d: mk('P2', ['ド', 'ン', 'パ'], ['C4', 'C4', 'E4']),
    P3a: mk('P3', ['ヨォ〜'], ['A4']),
    P3b: mk('P3', ['ア〜'], ['E4']),
    P3c: mk('P3', ['ナァ〜'], ['G4']),
    P4a: mk('P4', ['ソー', 'レ'], ['E4', 'A4']),
    P4b: mk('P4', ['ハイ', 'ヤ'], ['C4', 'E4']),
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const seq = (s, sec, first) => s.split(' ').map((p, i) => ({ p, sec, guide: i === 0 ? first : null }));
  const main = [
    { p: 'count', sec: 'count', guide: '部長のオンステージ！' },
    { p: 'rest', sec: 'I', guide: '3つ歌ったら、4拍目に「ハイ！」' },
    ...seq('P1a P1b P1c P1d P1e P1f', 'A'),
    { p: 'rest', sec: 'I', guide: '早口のあとは「ハイ・ハイ」（2回）' },
    ...seq('P2a P1a P2b P2c P1b P2d', 'B'),
    { p: 'rest', sec: 'I', guide: 'のば〜したら、裏で「ヨッ・ハッ」' },
    ...seq('P3a P1c P3b P2a P3c P2b P1d P3a', 'C'),
    { p: 'fin', sec: 'end', guide: '部長、最高です！' }
  ];
  const hard = {
    bpm: 106,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ 二次会' },
      { p: 'rest', sec: 'I', guide: '2つ歌ったら「ハイ・ハイ・ハイ」！' },
      ...seq('P1a P2a P3a P4a P1b P2b', 'A'),
      ...seq('P4b P3b P2c P4a P3c P2d', 'B', 'まだまだ歌うぞ'),
      ...seq('P4b P2a P3a P4a P2b P3b P4b P1c', 'C', 'ラスト！'),
      { p: 'fin', sec: 'end', guide: '部長、最高です！' }
    ]
  };
  const lessons = [
    { p: 'P1a', title: 'ハイ！', hint: '3つ歌う → 4拍目に「ハイ！」' },
    { p: 'P2a', title: 'ハイ・ハイ', hint: '早口で3つ → 3拍目・4拍目' },
    { p: 'P3a', title: 'ヨッ・ハッ', hint: 'のば〜す → 裏で2回' },
    { p: 'P4a', title: 'ハイハイハイ（ハード用）', hint: '2つ歌う → 3拍目・裏・4拍目' }
  ];

  const PROG = { A: ['Am', 'Dm', 'E7', 'Am'], B: ['F', 'G', 'Em7', 'Am'], C: ['Dm7', 'G7', 'Cmaj7', 'E7'], P: ['Am', 'E7'], I: ['E7'], count: ['Am'], end: ['Am'] };
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'rim', gain: 0.4 }));
    if (sec === 'end') return RG.Band.ending('Am');
    return RG.Band.bar(info, chart, { style: 'ballad', chord: info.chord, drums: 0.8, comp: 0.9, bass: 0.9, pad: sec === 'I' ? 0.5 : 0.35 });
  }
  function hitSounds(tg, kind) {
    const call = (tg.data && tg.data.call) || 'ハイ！';
    const s = [{ id: 'tamb', gain: 0.9 }, { id: `voice:crowd:${call}`, gain: 0.9, bus: 'voice' }];
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.3 });
    return s;
  }
  function preload() { return ['tamb', 'sparkle', 'boing', 'voice:crowd:ハイ！', 'voice:crowd:ハイ', 'voice:crowd:ヨッ！', 'voice:crowd:ハッ！']; }

  // ---------------- 描画 ----------------
  function bucho(g, x, y, beat, mouth, mood) {
    const ink = '#1a0b26';
    g.save(); g.translate(x + Math.sin(beat * Math.PI / 2) * 6, y); g.rotate(Math.sin(beat * Math.PI / 2) * 0.06);
    D.rrect(g, -28, 0, 56, 70, 14, '#f4f4f4', ink, 3);
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.lineTo(3, 50); g.lineTo(0, 56); g.lineTo(-3, 50); g.closePath(); g.fillStyle = '#c2185b'; g.fill(); // ネクタイ…の跡
    D.circ(g, 0, -22, 28, '#ffcfa8', ink, 3);
    if (mood !== 'angry') { g.globalAlpha = 0.6; D.ell(g, -16, -12, 7, 4, '#ff7a8a'); D.ell(g, 16, -12, 7, 4, '#ff7a8a'); g.globalAlpha = 1; } // 赤ら顔
    // 頭にネクタイ
    D.rrect(g, -30, -44, 60, 9, 4, '#c2185b', ink, 2);
    g.beginPath(); g.moveTo(28, -40); g.lineTo(44, -30 + Math.sin(beat * 6) * 3); g.lineTo(40, -22); g.closePath(); g.fillStyle = '#c2185b'; g.fill(); g.stroke();
    D.eyes(g, 0, -24, 10, 3.5, mood === 'angry' ? 'wide' : mouth > 0.2 ? 'closed' : mood === 'happy' ? 'happy' : 'normal');
    if (mood === 'angry') { D.line(g, -16, -34, -4, -30, ink, 3); D.line(g, 16, -34, 4, -30, ink, 3); D.sweat(g, 30, -30, 1.1); }
    if (mood === 'cry') { D.ell(g, -12, -12, 3, 8, '#8fd3ff'); D.ell(g, 12, -12, 3, 8, '#8fd3ff'); }
    D.ell(g, 0, -6, 7, 2 + mouth * 8, '#7a2a3a', ink, 2);
    // マイク
    g.save(); g.translate(20, 10); g.rotate(-0.6); D.rrect(g, -4, -4, 8, 34, 3, '#333', ink, 2); D.circ(g, 0, -8, 8, '#bbb', ink, 2); g.restore();
    D.circ(g, 22, 18, 8, '#ffcfa8', ink, 2);
    g.restore();
  }
  function buddy(g, x, y, beat, shake, color, you) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - U.hop(beat) * 2);
    D.rrect(g, -20, 0, 40, 46, 12, color, ink, 2.5);
    D.circ(g, 0, -16, 20, '#ffcfa8', ink, 2.5);
    D.rrect(g, -16, -38, 32, 10, 5, '#3a2a20');
    D.eyes(g, 0, -18, 7, 3, shake > 0 ? 'happy' : 'normal');
    D.mouth(g, 0, -8, 5, shake > 0 ? 'open' : 'smile');
    // タンバリン
    const a = shake > 0 ? -0.9 + Math.sin(shake * 20) * 0.3 : -0.2;
    g.save(); g.translate(18, 0); g.rotate(a); D.circ(g, 0, -22, 13, null, ink, 4); D.circ(g, 0, -22, 13, null, '#ffc23a', 2.5);
    for (let k = 0; k < 6; k++) D.circ(g, Math.cos(k) * 13, -22 + Math.sin(k) * 13, 3, '#ddd', ink, 1);
    g.restore();
    if (you) D.text(g, 'YOU', 0, 60, 11, '#ffe066', ink);
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
        // 部屋
        g.fillStyle = '#2b1640'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.save(); g.globalAlpha = 0.18; for (let k = -6; k < 14; k++) { g.fillStyle = k % 2 ? '#ff3d8b' : '#1fc7b6'; g.beginPath(); g.moveTo(k * 40, view.y0); g.lineTo(k * 40 + 14, view.y0); g.lineTo(k * 40 + 214, 420); g.lineTo(k * 40 + 200, 420); g.fill(); } g.restore();
        g.fillStyle = '#5a1f63'; g.fillRect(view.x0, 440, view.x1 - view.x0, view.y1 - 440); // ソファ
        D.rrect(g, 0, 430, 360, 22, 10, '#7a2a80', '#1a0b26', 2);
        // テレビ（歌詞）
        D.rrect(g, 30, 34, 300, 150, 10, '#0c1030', '#000', 4);
        const sky = g.createLinearGradient(0, 40, 0, 140); sky.addColorStop(0, '#ff7a1a'); sky.addColorStop(1, '#5a1f63');
        g.fillStyle = sky; g.fillRect(36, 40, 288, 96);
        D.circ(g, 260, 120, 22, '#ffe28a');
        g.fillStyle = '#1f3a7a'; g.fillRect(36, 118, 288, 18);
        for (let k = 0; k < 6; k++) D.line(g, 50 + k * 46 + (beat * 8) % 46, 126, 70 + k * 46 + (beat * 8) % 46, 126, '#8fb8ff', 2);
        // 歌詞（いま歌っている小節）
        const inst = chart.instanceAt(beat);
        const pat = inst && chart.game.patterns[inst.p];
        if (pat && pat.lyric) {
          const parts = [];
          inst.cues.forEach(c => parts.push({ t: c.data.s, b: c.beat, sung: true }));
          inst.targets.forEach(tg => parts.push({ t: tg.data.call.replace('！', ''), b: tg.beat, tg }));
          parts.sort((a, b) => a.b - b.b);
          g.font = '800 20px sans-serif';
          const widths = parts.map(p => Math.max(34, p.t.length * 20 + 8));
          let x = 180 - widths.reduce((s, w) => s + w, 0) / 2;
          parts.forEach((p, i) => {
            const w = widths[i], cx = x + w / 2; x += w;
            const done = beat >= p.b;
            if (p.sung) D.text(g, p.t, cx, 160, 20, done ? '#ffe066' : '#ffffff', '#1a0b26');
            else {
              const r = st.results.get(p.tg);
              const col = r ? (r.kind === 'miss' ? '#888' : '#ff3d8b') : 'rgba(255,255,255,.35)';
              D.text(g, p.t, cx, 160, 16, col, r && r.kind !== 'miss' ? '#ffffff' : null);
            }
          });
        }
        // 部長
        let mouth = 0;
        for (const c of chart.cues) { if (c.beat > beat + 0.01) break; if (c.type === 'sing' && beat - c.beat < 0.45) mouth = 1 - (beat - c.beat) / 0.45; }
        const dm = beat - st.lastMiss, dh = beat - st.lastHit;
        bucho(g, 180, 300, beat, Math.max(mouth, fin !== null ? 0.8 : 0), fin !== null || combo >= 10 ? 'cry' : dm >= 0 && dm < 1.2 ? 'angry' : dh >= 0 && dh < 0.8 ? 'happy' : 'normal');
        // 同僚（左）ときみ（右）
        const dt = beat - st.lastTap;
        let auto = -1;
        for (const tg of chart.inputs) { if (tg.beat > beat) break; if (beat - tg.beat < 0.4) auto = beat - tg.beat; }
        buddy(g, 64, 396, beat, auto >= 0 ? 1 - auto / 0.4 : 0, '#1fc7b6');
        buddy(g, 296, 396, beat, dt >= 0 && dt < 0.4 ? 1 - dt / 0.4 : 0, '#ff7a1a', true);
        if (fin !== null) {
          for (let k = 0; k < 18; k++) { const x = (k * 53 + fin * 90) % 360, y = 200 + ((k * 37 + fin * 160) % 240); D.rrect(g, x, y, 6, 10, 2, ['#ffc23a', '#ff3d8b', '#1fc7b6'][k % 3]); }
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 222); g.scale(s, s); g.rotate(-0.06);
          D.text(g, '100点！…の気分', 0, 0, 26, '#ffe066', '#1a0b26');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#2b1640'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    D.rrect(g, 8, 6, 84, 34, 4, '#0c1030', '#000', 2);
    D.text(g, '♪ハイ！', 50, 23, 13, '#ffe066');
    g.save(); g.translate(50, 70); g.scale(0.5, 0.5); bucho(g, 0, 0, t * 2, Math.max(0, Math.sin(t * 6)), 'happy'); g.restore();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.karaoke = {
    id: 'karaoke', title: 'カラオケ合いの手', color: '#c2185b', group: 'beat', level: 3,
    howto: '部長の歌のすきまに合いの手。3つ→「ハイ！」、早口→「ハイ・ハイ」、のばす→裏で「ヨッ・ハッ」',
    bpm: 96, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: { fin: [{ id: 'voice:crowd:ブチョー！', gain: 1.1, bus: 'voice', say: 'ブチョー！', who: 'crowd' }, { id: 'cheer', gain: 0.8 }] },
    missSound: 'boing',
    anchors: { bucho: { x: 200, y: 250 }, crowd: { x: 80, y: 360 } },
    quips: {
      miss: [{ id: 'voice:uncle:ノリガワルイゾ！', say: 'ノリが悪いぞ！', who: 'bucho' }, { id: 'voice:uncle:オイ！', say: 'オイ！', who: 'bucho' }],
      extra: [{ id: 'voice:uncle:ウタッテルダロ！', say: '歌ってるだろ！', who: 'bucho' }],
      combo: [{ id: 'voice:uncle:サイコー！', say: 'サイコー！', who: 'bucho' }, { id: 'voice:uncle:ナケルネ〜', say: '泣けるね〜', who: 'bucho' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
