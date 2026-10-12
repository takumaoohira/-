/*
 * メニューのBGM（タイトル・選択画面・設定で流れる、やる気の出るファンク）
 *   122BPM・16小節のループ（Aメロ8小節 → サビ8小節）。編曲は RG.Band を使う。
 *   ゲームを始めると0.3秒でフェードアウト。画面がバックグラウンドへ行くと止まる。
 */
RG.MenuMusic = (function () {
  const BPM = 122, SPB = 60 / BPM;
  const VERSE = ['Dmaj7', 'Bm7', 'Em9', 'A9', 'Dmaj7', 'Bm7', 'Em9', 'A9'];
  const HOOK = ['Gmaj7', 'A9', 'F#m7', 'Bm7', 'Gmaj7', 'A9', 'Bm7', 'A9'];
  // サビのメロディ（口ずさめる短いフレーズ）
  const HOOK_MEL = [
    'F#5 . A5 . B5 . A5 F#5', '. . E5 . F#5 - . .', 'A5 . B5 . C#6 . B5 A5', '. . F#5 . B5 - . .',
    'F#5 . A5 . B5 . D6 .', 'C#6 . A5 . E5 - . .', 'F#5 . E5 . D5 . B4 .', 'C#5 - E5 - A5 - . .'
  ];
  const VERSE_RIFF = ['. . . . . . . .', '. . . . F#5 . A5 .', '. . . . . . . .', '. . E5 . F#5 . . .'];
  const fakeChart = { spb: SPB, game: { patterns: {} } };
  const M = { on: false, sb: null, timer: 0, bar: 0, next: 0, greeted: false };

  function barEvents(k) {
    const pos = k % 16, hook = pos >= 8, i = pos % 8;
    const info = { sec: hook ? 'H' : 'V', secBar: i, fill: i === 7, p: null, pbar: 0 };
    const ev = RG.Band.bar(info, fakeChart, {
      style: 'funk', chord: hook ? HOOK[i] : VERSE[i], drums: 0.95, comp: 0.85, bass: 0.95, pad: hook ? 0.25 : 0,
      mel: hook ? HOOK_MEL[i] : VERSE_RIFF[i % 4], melInst: hook ? 'lead' : 'organ', melGain: hook ? 0.34 : 0.3, melPan: 0.15
    });
    // Aメロはブラスの「パッ！」、サビの頭は観客の「イェーイ！」
    if (!hook && (i === 0 || i === 4)) { const ch = RG.Band.chord(VERSE[i]); ev.push({ b: 0, id: `brass:${ch.notes.slice(0, 3).join(',')}:0.22`, gain: 0.45, pan: 0.2, rev: 0.2 }, { b: 1.5, id: `brass:${ch.notes.slice(0, 3).join(',')}:0.15`, gain: 0.35, pan: 0.2, rev: 0.2 }); }
    if (pos === 8) ev.push({ b: 0, id: 'voice:crowd:イェーイ！', gain: 0.6, bus: 'voice', rev: 0.2 });
    if (pos === 7) ev.push({ b: 2, id: 'rise:x:1', gain: 0.35 });
    ev.push(...[0.5, 1.5, 2.5, 3.5].map(b => ({ b, id: 'clap', gain: 0.12, pan: -0.3 }))); // 裏の手拍子で前に進む感じ
    return ev;
  }

  function schedule() {
    if (!M.on) return;
    const A = RG.Audio, now = A.ctx.currentTime;
    while (M.next < now + 0.6) {
      const t0 = M.next;
      barEvents(M.bar).forEach(e => {
        const when = t0 + e.b * SPB - (e.id.startsWith('voice:') ? RG.Voice.onset(e.id) : 0);
        if (when >= now - 0.02) A.play(e.id, when, M.sb[e.bus || 'bgm'], e.gain, M.sb, e.pan || 0, e.rev || 0);
      });
      M.bar++;
      M.next += 4 * SPB;
    }
  }

  function start() {
    const A = RG.Audio;
    if (M.on || !A.ctx || A.ctx.state !== 'running') return;
    M.on = true;
    M.sb = A.createSessionBus();
    M.sb.bgm.gain.value = 2.2; // ゲーム中の曲と同じくらいの大きさに（16小節でピーク約0.65）
    // 最初の2小節の音を先に作っておく（再生中に合成で引っかからないように）
    [0, 1].forEach(k => barEvents(k).forEach(e => A.buffer(e.id)));
    M.bar = 0;
    M.next = A.ctx.currentTime + 0.15;
    if (!M.greeted) { M.greeted = true; A.play('voice:boss:レッツグルーヴ！', A.ctx.currentTime + 0.05, M.sb.voice, 0.8, M.sb, 0, 0.2); }
    schedule();
    M.timer = setInterval(schedule, 30);
  }

  function stop(fade = 0.3) {
    if (!M.on) return;
    M.on = false;
    clearInterval(M.timer);
    const sb = M.sb, A = RG.Audio;
    M.sb = null;
    const t = A.ctx.currentTime;
    ['bgm', 'voice', 'sfx', 'cue'].forEach(k => { try { sb[k].gain.setTargetAtTime(0, t, fade / 3); } catch (e) {} });
    setTimeout(() => A.destroySessionBus(sb), fade * 1000 + 100);
  }

  return { start, stop, get playing() { return M.on; }, BPM, _bar: barEvents };
})();
