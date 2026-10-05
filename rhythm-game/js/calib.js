/*
 * タイミング自動調整
 *  1) 入力：一定のテンポの「カッ」に合わせて20回タップ → 音とのずれの中央値を「入力の補正」の目安にする
 *     （判定では「入力時刻 − 入力の補正」を使うので、遅れて押す人は＋の値になり、正しい方向に補正される）
 *  2) 映像：音と同時に跳ねるボールを見て、ずれて見えるときは「映像の補正」を手動で合わせる（判定には影響しない）
 */
RG.Calib = (function () {
  const $ = id => document.getElementById(id);
  const BPM = 100, SPB = 60 / BPM, LEAD = 4, TAPS = 20, WARMUP = 2;
  const C = { mode: 'idle', sb: null, startAt: 0, clicks: [], taps: [], raf: 0, timer: 0, idx: 0, result: null };

  function enter() {
    stop();
    C.mode = 'idle';
    $('calib-title').textContent = 'タイミング調整';
    $('calib-msg').innerHTML = '「カッ」という音に合わせて、画面のどこかを20回タップします。<br><b>画面は見ずに、音だけ</b>に合わせてください。';
    $('calib-result').textContent = `いまの入力の補正：${fmt(RG.Storage.settings.inputOffsetMs)}`;
    $('btn-calib-start').hidden = false; $('btn-calib-start').textContent = 'スタート';
    $('btn-calib-apply').hidden = true;
    $('btn-calib-visual').hidden = false;
    $('calib-vis-ctrl').hidden = true;
    draw();
  }
  const fmt = v => (v > 0 ? '+' : '') + Math.round(v) + 'ms';

  async function begin(mode) {
    stop();
    await RG.Audio.resume();
    const A = RG.Audio;
    C.mode = mode;
    C.sb = A.createSessionBus();
    A.resetClock();
    C.startAt = A.ctx.currentTime + 0.4;
    C.taps = []; C.idx = 0; C.result = null;
    const n = mode === 'tap' ? LEAD + TAPS : 100000;
    C.clicks = [];
    C.total = n;
    $('btn-calib-start').hidden = true;
    $('btn-calib-apply').hidden = true;
    if (mode === 'tap') {
      $('calib-msg').innerHTML = '最初の4回はよく聴いて…<br>そのあと「カッ」に合わせてタップ！';
      $('calib-result').textContent = '';
    } else {
      $('calib-msg').innerHTML = 'ボールが床に着く瞬間と「カッ」が同時に見えますか？<br>ボールが<b>先に</b>着いて見えたら＋、<b>遅れて</b>見えたら−';
      $('calib-vis-ctrl').hidden = false;
      $('btn-calib-visual').hidden = true;
      showVis();
    }
    const sched = () => {
      const now = A.ctx.currentTime;
      while (C.idx < n && C.startAt + C.idx * SPB < now + 0.25) {
        const t = C.startAt + C.idx * SPB;
        A.play(C.idx < LEAD && mode === 'tap' ? 'stick' : 'stickHi', t, C.sb.cue, 1, C.sb);
        C.clicks.push(C.idx * SPB);
        C.idx++;
      }
    };
    sched();
    C.timer = setInterval(sched, 25);
    const loop = () => {
      if (C.mode === 'idle') return;
      C.raf = requestAnimationFrame(loop);
      A.updateClock();
      draw();
      if (C.mode === 'tap' && A.heardNow() - C.startAt > (LEAD + TAPS) * SPB + 0.3) finishTap();
    };
    C.raf = requestAnimationFrame(loop);
  }

  function input(ms) {
    if (C.mode !== 'tap') return;
    const t = RG.Audio.perfToHeard(ms) - C.startAt; // 補正前の生の時刻
    const k = Math.round(t / SPB);
    if (k < LEAD || k >= LEAD + TAPS) return;
    const diff = t - k * SPB;
    if (Math.abs(diff) > SPB * 0.45) return;
    if (C.taps.some(x => x.k === k)) return;
    C.taps.push({ k, diff });
    const left = LEAD + TAPS - 1 - k;
    $('calib-msg').innerHTML = left > 0 ? `その調子！ のこり ${left} 回` : 'おしまい！';
  }

  function finishTap() {
    const A = RG.Audio;
    const used = C.taps.filter(x => x.k >= LEAD + WARMUP).map(x => x.diff * 1000);
    stopAudio();
    C.mode = 'done';
    $('btn-calib-start').hidden = false; $('btn-calib-start').textContent = 'もう一度';
    if (used.length < 8) {
      $('calib-msg').textContent = 'タップの数が足りませんでした。もう一度試してください。';
      $('calib-result').textContent = '';
      draw();
      return;
    }
    const med = RG.U.median(used), sd = RG.U.stdev(used);
    C.result = Math.round(RG.U.clamp(med, -300, 300));
    const dir = Math.abs(med) < 8 ? 'ほぼぴったりです' : med > 0 ? `音より ${Math.round(med)}ms 遅れて押しています` : `音より ${Math.round(-med)}ms 早く押しています`;
    $('calib-msg').innerHTML = `あなたのタップは、${dir}。` + (sd > 55 ? '<br><small>ばらつきが大きめです。もう一度測ると確実です。</small>' : '');
    $('calib-result').innerHTML = `おすすめの入力の補正：<b>${fmt(C.result)}</b><br><small>（いまの設定 ${fmt(RG.Storage.settings.inputOffsetMs)}）</small>`;
    $('btn-calib-apply').hidden = false;
    draw();
    void A;
  }

  function apply() {
    if (C.result === null) return;
    RG.Storage.settings.inputOffsetMs = C.result;
    RG.Storage.settings.calibratedAt = Date.now();
    RG.Storage.save();
    RG.App.toast(`入力の補正を ${fmt(C.result)} にしました`);
    $('btn-calib-apply').hidden = true;
    $('calib-result').textContent = `入力の補正：${fmt(C.result)}（保存しました）`;
  }

  function showVis() { $('calib-result').textContent = `映像の補正：${fmt(RG.Storage.settings.visualOffsetMs)}`; }
  function adjVis(d) {
    const S = RG.Storage.settings;
    S.visualOffsetMs = RG.U.clamp(S.visualOffsetMs + d, -300, 300);
    RG.Storage.save();
    showVis();
  }

  function draw() {
    const cv = $('calib-canvas');
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr) || 1; cv.height = Math.round(r.height * dpr) || 1; }
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const s = Math.min(W / 360, H / 220); g.setTransform(s, 0, 0, s, (W - 360 * s) / 2, (H - 220 * s) / 2);
    const D = RG.D;
    if (C.mode === 'vis') {
      const t = RG.Audio.heardNow() - C.startAt - RG.Storage.settings.visualOffsetMs / 1000;
      const b = t / SPB, ph = ((b % 1) + 1) % 1;
      const y = 160 - Math.sin(Math.PI * ph) * 110;
      D.line(g, 60, 186, 300, 186, 'rgba(255,255,255,.5)', 3);
      const land = b >= 0 ? Math.max(0, 1 - Math.min(ph, 1 - ph) / 0.08) : 0;
      if (land > 0) { g.globalAlpha = land * 0.6; D.ell(g, 180, 186, 40 * land + 10, 6, '#ffe066'); g.globalAlpha = 1; }
      const sq = ph < 0.08 || ph > 0.92 ? 0.8 : 1;
      D.ell(g, 180, y, 22 / sq * 0.9, 22 * sq, '#ff9f5a', '#fff', 3);
      return;
    }
    // タップの記録（早い＝左、遅い＝右）
    D.line(g, 180, 30, 180, 190, 'rgba(255,255,255,.35)', 2);
    D.text(g, '早い', 60, 16, 14, '#8fd3ff', null, 'center', 700);
    D.text(g, '遅い', 300, 16, 14, '#ffb08f', null, 'center', 700);
    D.text(g, 'ぴったり', 180, 205, 12, 'rgba(255,255,255,.7)', null, 'center', 700);
    C.taps.forEach((tp, i) => {
      const x = 180 + RG.U.clamp(tp.diff * 1000, -150, 150) * 0.9;
      const y = 36 + (tp.k - LEAD) * 7.5;
      D.circ(g, x, y, 5, tp.k < LEAD + WARMUP ? 'rgba(255,255,255,.35)' : tp.diff < 0 ? '#8fd3ff' : '#ffb08f');
    });
    if (C.mode === 'tap') {
      const k = Math.floor((RG.Audio.heardNow() - C.startAt) / SPB);
      const left = Math.max(0, LEAD + TAPS - Math.max(k, 0));
      D.text(g, k < LEAD ? 'きいて…' : `${left}`, 330, 190, 16, '#fff', null, 'center', 800);
    }
    if (C.result !== null) {
      const x = 180 + RG.U.clamp(C.result, -150, 150) * 0.9;
      D.line(g, x, 30, x, 190, '#ffe066', 2);
    }
  }

  function stopAudio() {
    clearInterval(C.timer);
    cancelAnimationFrame(C.raf);
    if (C.sb) { RG.Audio.destroySessionBus(C.sb); C.sb = null; }
  }
  function stop() {
    stopAudio();
    if (C.mode === 'tap') { C.mode = 'idle'; $('btn-calib-start').hidden = false; $('btn-calib-start').textContent = 'スタート'; $('calib-msg').textContent = '中断しました。もう一度スタートしてください。'; }
    else if (C.mode === 'vis') { C.mode = 'idle'; $('calib-vis-ctrl').hidden = true; $('btn-calib-visual').hidden = false; $('btn-calib-start').hidden = false; }
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('btn-calib-start').addEventListener('click', () => begin('tap'));
    $('btn-calib-apply').addEventListener('click', apply);
    $('btn-calib-visual').addEventListener('click', () => begin('vis'));
    document.querySelectorAll('[data-vadj]').forEach(b => b.addEventListener('click', () => adjVis(+b.dataset.vadj)));
    $('btn-calib-back').addEventListener('click', () => { stop(); C.mode = 'idle'; RG.App.show('settings'); });
  });

  return { enter, input, stop, get state() { return C; } };
})();
