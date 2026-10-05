/*
 * ミニゲーム⑦「キメ照明ショー」（音ハメ）
 *   ファンクバンドのライブ。曲が「キメ」で止まる瞬間に、照明係のきみがスイッチを入れる。
 *   キメの直前の「前ぶり」で、キメのリズムが分かる：
 *     スネアの「タタタタ」         → 次の小節の頭で「ジャン！」（1回）
 *     ホーンの「ヘイ！」           → 「ジャン・ジャン・ジャン」（1・2・3拍目）
 *     タムの「ドン・ドン」         → 「ジャッ・ジャッ・ジャン」（付点8分＝0・0.75・1.5拍）
 *     手拍子「パン・パン」（ハード）→ 「ンジャ・ンジャ」（裏拍）
 *   成功するとバンドの「ジャン！」と照明が決まる。失敗すると……シーン。
 */
(function () {
  const { U, D } = RG;
  const K = (cues, ins) => ({ len: 8, cues, inputs: ins.map(b => ({ b, type: 'kime' })) });
  const patterns = {
    K1: K([{ b: 3, type: 'roll' }], [4]),
    K3: K([{ b: 3, type: 'hey' }], [4, 5, 6]),
    KS: K([{ b: 3, type: 'tomA' }, { b: 3.5, type: 'tomB' }], [4, 4.75, 5.5]),
    KO: K([{ b: 3, type: 'clapx' }, { b: 3.5, type: 'clapx' }], [4.5, 5.5]),
    G: { len: 4, cues: [], inputs: [] },
    fin: { len: 4, end: true, cues: [{ b: 0, type: 'fin' }], fx: [{ b: 0, type: 'finale' }] }
  };
  const main = [
    { p: 'count', sec: 'count', guide: 'キメ照明ショー、開演！' },
    { p: 'G', sec: 'I', guide: '曲が止まる「キメ」で照明スイッチ！' },
    { p: 'K1', sec: 'A', demo: true, guide: 'お手本：「タタタタ」→ 次の頭で「ジャン！」' },
    { p: 'K1', sec: 'A', guide: 'きみの番！' }, { p: 'K1', sec: 'A' }, { p: 'G', sec: 'A' }, { p: 'K1', sec: 'A' },
    { p: 'K3', sec: 'B', demo: true, guide: 'お手本：「ヘイ！」→ ジャン・ジャン・ジャン' },
    { p: 'K3', sec: 'B', guide: 'きみの番！' }, { p: 'K1', sec: 'B' }, { p: 'K3', sec: 'B' },
    { p: 'KS', sec: 'C', demo: true, guide: 'お手本：「ドン・ドン」→ ジャッ・ジャッ・ジャン' },
    { p: 'KS', sec: 'C', guide: 'きみの番！' }, { p: 'K3', sec: 'C' }, { p: 'KS', sec: 'C' }, { p: 'K1', sec: 'C' },
    { p: 'fin', sec: 'end', guide: 'ショー大成功！' }
  ];
  const hard = {
    bpm: 120,
    main: [
      { p: 'count', sec: 'count', guide: 'ハード！ アンコール公演' },
      { p: 'KO', sec: 'I', demo: true, guide: 'お手本：「パン・パン」→ ンジャ・ンジャ（裏）' },
      ...['K1', 'K3', 'KS', 'KO', 'K3'].map((p, i) => ({ p, sec: 'A', guide: i === 0 ? 'タタタタ=1回 / ヘイ=3回 / ドンドン=付点 / パンパン=裏' : null })),
      ...['KS', 'KO', 'K1', 'KS', 'KO'].map(p => ({ p, sec: 'C' })),
      { p: 'fin', sec: 'end', guide: 'ショー大成功！' }
    ]
  };
  const lessons = [
    { p: 'K1', title: '1発キメ', hint: 'タタタタ → 次の頭で「ジャン」' },
    { p: 'K3', title: '3連キメ', hint: '「ヘイ！」→ ジャン・ジャン・ジャン' },
    { p: 'KS', title: '付点のキメ', hint: 'ドン・ドン → ジャッ・ジャッ・ジャン' },
    { p: 'KO', title: '裏のキメ（ハード用）', hint: 'パン・パン → ンジャ・ンジャ' }
  ];

  const PROG = { A: ['E9', 'E9'], B: ['A9', 'E9'], C: ['D9', 'E7#9'], P: ['E9'], I: ['E9'], count: ['E9'], end: ['E9'] };
  const RIFF = ['E5 . G5 . A5 . . .', '. . B5 . A5 . G5 .'];
  function chordFor(sec, i) { const p = PROG[sec] || PROG.A; return p[i % p.length]; }
  function music(info, chart) {
    const sec = info.sec;
    if (sec === 'count') return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.25 }));
    if (sec === 'end') return RG.Band.ending('E7#9').concat([{ b: 0, id: 'brass:E4,G#4,B4,D5:0.9', gain: 0.8, rev: 0.3 }]);
    const isK = info.p && info.p[0] === 'K';
    // キメの小節（2小節目）はブレイク：ハイハットの刻みだけ残す
    if (isK && info.pbar === 1) return [0, 1, 2, 3].map(b => ({ b, id: 'hh2', gain: 0.12, pan: 0.2 }));
    let ev = RG.Band.bar(info, chart, { style: 'funk', chord: info.chord, drums: 0.9, comp: 0.9, bass: 0.9, mel: info.p === 'G' ? null : RIFF[info.secBar % 2], melInst: 'organ', melGain: 0.35, melPan: 0.3 });
    // 前ぶりの拍（4拍目）は空ける
    if (isK) ev = ev.filter(e => e.b < 3);
    return ev;
  }
  function hitSounds(tg, kind, chart) {
    const bar = chart.barAt(tg.beat), ch = RG.Band.chord((bar && bar.chord) || 'E9');
    const s = [{ id: `stab:${ch.notes.slice(0, 4).join(',')}:0.35`, gain: 0.9 }, { id: 'kick2', gain: 0.8 }, { id: `sbass:${RG.Band.nn(ch.bass)}:0.3`, gain: 0.6 }];
    if (tg.k === 0) s.push({ id: 'crash', gain: 0.45 });
    if (kind === 'perfect') s.push({ id: 'sparkle', gain: 0.35 });
    return s;
  }
  function preload() {
    const ids = ['boing', 'crash', 'kick2', 'sparkle', 'snare2', 'tom:A2', 'tom:E2', 'clap'];
    Object.values(PROG).flat().forEach(c => { const ch = RG.Band.chord(c); ids.push(`stab:${ch.notes.slice(0, 4).join(',')}:0.35`, `sbass:${RG.Band.nn(ch.bass)}:0.3`); });
    return ids;
  }

  // ---------------- 描画 ----------------
  const LIGHTS = [{ x: 50, c: '#ff3d8b' }, { x: 130, c: '#ffc23a' }, { x: 230, c: '#1fc7b6' }, { x: 310, c: '#ff7a1a' }];
  function player(g, x, y, beat, kind, pose, k, opt = {}) {
    const ink = '#1a0b26';
    g.save(); g.translate(x, y - (pose === 'groove' ? U.hop(beat) * 4 : pose === 'jump' ? 14 * k : 0));
    if (pose === 'look') g.rotate(0.15);
    D.rrect(g, -18, -10, 36, 50, 10, opt.suit || '#3d7bd9', ink, 2.5);
    for (let i = 0; i < 9; i++) D.circ(g, Math.cos(i / 9 * D.TAU) * 18, -36 + Math.sin(i / 9 * D.TAU) * 12, 12, '#1d1420');
    D.circ(g, 0, -26, 15, opt.skin || '#c98a5a', ink, 2.5);
    if (pose === 'look') D.eyes(g, 3, -28, 6, 3, 'wide', 1); else D.shades(g, 0, -28, 6, 4.5, opt.lens || '#1a1028');
    D.mouth(g, 0, -18, 4, pose === 'jump' ? 'open' : pose === 'look' ? 'flat' : 'smile');
    // 楽器
    if (kind === 'bass') { g.save(); g.rotate(-0.5 + (pose === 'jump' ? -0.4 * k : 0)); D.rrect(g, -30, 6, 60, 10, 4, '#b5651d', ink, 2); D.ell(g, -26, 11, 12, 14, '#d07a2a', ink, 2); g.restore(); }
    if (kind === 'horn') { g.save(); g.translate(8, -18); g.rotate(pose === 'jump' || opt.raise ? -0.9 : -0.2); D.rrect(g, 0, -3, 34, 6, 2, '#ffc23a', ink, 1.5); D.ell(g, 38, 0, 6, 10, '#ffc23a', ink, 1.5); g.restore(); }
    g.restore();
  }
  function drummer(g, x, y, beat, hit, sticksUp) {
    const ink = '#1a0b26';
    D.ell(g, x - 34, y + 16, 18, 8, '#c0c0d0', ink, 2); D.ell(g, x + 34, y + 10, 18, 7, '#ffd36b', ink, 2);
    player(g, x, y - 20, beat, 'drums', hit > 0 ? 'jump' : 'groove', hit, { suit: '#ff3d8b' });
    D.circ(g, x, y + 40, 24, '#ff3d8b', ink, 3); D.circ(g, x, y + 40, 15, '#ffd0e0');
    const a = sticksUp ? -2.4 : hit > 0 ? 0.6 : -0.4 + Math.sin(beat * Math.PI * 2) * 0.3;
    [-1, 1].forEach(s => { g.save(); g.translate(x + s * 14, y + 4); g.rotate(s * a); D.line(g, 0, 0, s * 22, -10, '#f0e0c0', 3); g.restore(); });
  }

  function createScene(session) {
    const chart = session.chart;
    const st = { results: new Map(), lastHit: -99, lastMiss: -99, lastTap: -99, n: 0 };
    return {
      onJudge(tg, kind, vbeat, r) {
        const at = r && r.demo ? tg.beat : vbeat;
        st.results.set(tg, { kind, at });
        if (kind === 'miss') st.lastMiss = at; else { st.lastHit = at; st.n++; }
        if (r && r.demo) st.lastTap = tg.beat;
      },
      onTap(vbeat) { st.lastTap = vbeat; },
      render(g, beat, view) {
        const finFx = chart.fx.find(x => x.type === 'finale');
        const fin = finFx && beat >= finFx.beat ? beat - finFx.beat : null;
        const inst = chart.instanceAt(beat);
        const isK = inst && inst.p[0] === 'K';
        const breakBar = isK && beat - inst.start >= 4;
        const pickup = isK && beat - inst.start >= 2.6 && beat - inst.start < 4;
        // 背景
        g.fillStyle = '#120818'; g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
        g.fillStyle = '#2b1640'; for (let k = 0; k < 9; k++) g.fillRect(k * 44 - 8, 70, 20, 300);
        D.rrect(g, -10, 34, 380, 14, 4, '#444', '#000', 2); // トラス
        // 照明（成功の瞬間に開く）
        const dh = beat - st.lastHit;
        const burst = fin !== null ? 0.6 : dh >= 0 && dh < 0.9 ? (1 - dh / 0.9) : 0;
        LIGHTS.forEach((L, i) => {
          const on = burst > 0 && (fin !== null || (st.n + i) % 2 === 0 || dh < 0.3);
          if (on) {
            g.save(); g.globalAlpha = 0.45 * burst;
            const gr = g.createLinearGradient(L.x, 48, L.x, 420); gr.addColorStop(0, L.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.beginPath(); g.moveTo(L.x - 8, 48); g.lineTo(L.x - 70 + i * 10, 420); g.lineTo(L.x + 70 - i * 10, 420); g.lineTo(L.x + 8, 48); g.fill();
            g.restore();
          }
          D.rrect(g, L.x - 10, 42, 20, 16, 4, on ? L.c : '#333', '#000', 2);
        });
        // ステージの床
        g.fillStyle = '#2a1830'; g.fillRect(view.x0, 380, view.x1 - view.x0, 40);
        D.line(g, view.x0, 380, view.x1, 380, '#ffc23a', 3);

        // バンド
        const dm = beat - st.lastMiss;
        const look = dm >= 0 && dm < 1.4;
        const pose = fin !== null ? 'jump' : look ? 'look' : breakBar ? (dh >= 0 && dh < 0.5 ? 'jump' : 'still') : 'groove';
        const pk = fin !== null ? Math.abs(Math.sin(fin * Math.PI)) : dh >= 0 && dh < 0.5 ? 1 - dh / 0.5 : 0;
        drummer(g, 180, 300, beat, pose === 'jump' ? pk : 0, pickup && inst.cues.some(c => c.type === 'roll'));
        player(g, 76, 330, beat + 0.1, 'bass', pose, pk, { suit: '#1fc7b6', skin: '#8a5a3a' });
        player(g, 286, 330, beat + 0.2, 'horn', pose, pk, { suit: '#ffc23a', raise: pickup && inst.cues.some(c => c.type === 'hey') });
        if (look) { D.text(g, '?', 96, 270, 22, '#fff', '#1a0b26'); D.text(g, '?', 306, 270, 22, '#fff', '#1a0b26'); }
        if (pk > 0.5 && breakBar) D.text(g, 'キメッ！', 180, 214, 24, '#ffc23a', '#1a0b26');
        // ブレイク中の静けさ（「・・・」）
        if (breakBar && dh > 0.6 && !look) { g.globalAlpha = 0.5; D.text(g, '…', 180, 240, 20, '#fff'); g.globalAlpha = 1; }

        // 照明ブース（手前）
        D.rrect(g, 96, 452, 168, 70, 12, '#2a2a3a', '#000', 3);
        for (let k = 0; k < 6; k++) D.circ(g, 116 + k * 12, 470, 4, (burst > 0 && k % 2 === 0) ? LIGHTS[k % 4].c : '#555');
        const dt = beat - st.lastTap, down = dt >= 0 && dt < 0.25;
        D.rrect(g, 214, down ? 470 : 448, 14, down ? 20 : 42, 4, '#ff3d6e', '#000', 2); // レバー
        D.circ(g, 221, down ? 470 : 448, 8, '#ff3d6e', '#000', 2);
        // 照明係（ネコ）
        g.save(); g.translate(150, 446);
        D.circ(g, 0, 0, 18, '#e9a85a', '#1a0b26', 2.5);
        g.beginPath(); g.moveTo(-15, -8); g.lineTo(-10, -26); g.lineTo(-2, -14); g.moveTo(15, -8); g.lineTo(10, -26); g.lineTo(2, -14); g.fillStyle = '#e9a85a'; g.fill(); g.stroke();
        D.eyes(g, 0, -2, 7, 3, look ? 'wide' : dh >= 0 && dh < 0.6 ? 'happy' : 'normal');
        g.beginPath(); g.arc(0, -4, 20, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 3; g.strokeStyle = '#1fc7b6'; g.stroke();
        g.restore();
        D.text(g, '照明', 180, 508, 12, '#ffc23a', null, 'center', 800);

        if (fin !== null) {
          const s = U.ease.outBack(U.prog(fin, 0, 0.4));
          g.save(); g.translate(180, 130); g.scale(s, s); g.rotate(-0.06);
          D.text(g, 'ショー大成功！', 0, 0, 32, '#ffc23a', '#1a0b26');
          g.restore();
        }
      }
    };
  }

  function drawIcon(g, w, h, t) {
    g.fillStyle = '#120818'; g.fillRect(0, 0, w, h);
    g.save(); g.scale(w / 100, h / 100);
    const on = Math.sin(t * 4) > 0;
    LIGHTS.forEach((L, i) => { if (on) { g.globalAlpha = 0.35; g.fillStyle = L.c; g.beginPath(); g.moveTo(L.x / 3.6 + 2, 8); g.lineTo(i * 25, 100); g.lineTo(i * 25 + 25, 100); g.fill(); g.globalAlpha = 1; } D.rrect(g, L.x / 3.6, 4, 7, 6, 2, L.c); });
    g.save(); g.translate(50, 66); g.scale(0.7, 0.7); player(g, 0, 0, t * 2, 'horn', on ? 'jump' : 'groove', 1, { suit: '#ffc23a' }); g.restore();
    g.restore();
  }

  RG.Games = RG.Games || {};
  RG.Games.kime = {
    id: 'kime', title: 'キメ照明ショー', color: '#ffc23a', group: 'beat', level: 3,
    howto: '曲が止まる「キメ」でタップ。前ぶり（タタタタ／ヘイ！／ドン・ドン）でキメのリズムが分かる',
    bpm: 110, offset: 0,
    patterns, main, hard, lessons, finalePattern: 'fin',
    cueSounds: {
      roll: [0, 0.25, 0.5, 0.75].map((d, i) => ({ id: 'snare2', d, gain: 0.6 + i * 0.15 })),
      hey: { id: 'voice:boss:ヘイ！', gain: 1.5, say: 'ヘイ！', who: 'horn', len: 0.8 },
      tomA: { id: 'tom:A2', gain: 1.2 }, tomB: { id: 'tom:E2', gain: 1.2 },
      clapx: { id: 'clap', gain: 1.1 },
      fin: [{ id: 'cheer', gain: 0.9 }, { id: 'voice:crowd:アンコール！', gain: 1, bus: 'voice', say: 'アンコール！', who: 'crowd', d: 1 }]
    },
    missSound: 'boing',
    anchors: { horn: { x: 290, y: 270 }, drums: { x: 180, y: 240 }, crowd: { x: 180, y: 430 }, bass: { x: 80, y: 270 } },
    quips: {
      miss: [{ id: 'voice:boss:アレ？', say: 'アレ？', who: 'horn' }, { id: 'voice:robo:シーン', say: 'シーン…', who: 'drums' }],
      extra: [{ id: 'voice:boss:マダダヨ！', say: 'まだだよ！', who: 'bass' }],
      combo: [{ id: 'voice:crowd:キマッタ！', say: 'キマッタ！', who: 'crowd' }, { id: 'voice:boss:イエー！', say: 'イエー！', who: 'horn' }]
    },
    chordFor, music, hitSounds, preload, createScene, drawIcon
  };
})();
