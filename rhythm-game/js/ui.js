/* 画面遷移・入力の受付・保存（タイトル → 選択 → 練習／本編 → 結果） */
RG.App = (function () {
  const $ = id => document.getElementById(id);
  const GAME_ORDER = ['mochi', 'penguin', 'echo', 'pingpong', 'golf'].filter(id => RG.Games && RG.Games[id]);
  const DESIGN_W = 360, DESIGN_H = 540;

  const App = {
    screen: 'title',
    session: null,
    last: null,         // 直前のプレイ {id, mode, opts}
    dpr: 1,
    titleRaf: 0
  };

  App.show = function (name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    App.screen = name;
    if (name === 'title') App.titleLoop(); else cancelAnimationFrame(App.titleRaf);
    if (name === 'select') App.buildSelect();
    if (name === 'settings') App.syncSettings();
  };

  App.toast = function (msg, ms = 3200) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(App._toastT);
    App._toastT = setTimeout(() => { t.hidden = true; }, ms);
  };

  // ---------- タイトル ----------
  App.titleLoop = function () {
    const cv = $('title-canvas');
    const g = cv.getContext('2d');
    const loop = (ms) => {
      if (App.screen !== 'title') return;
      App.titleRaf = requestAnimationFrame(loop);
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      const n = GAME_ORDER.length, t = ms / 1000, size = Math.min(cv.width / (n * 1.12 + 0.3), cv.height * 0.5);
      GAME_ORDER.forEach((id, i) => {
        const k = i - (n - 1) / 2;
        const x = cv.width / 2 + k * size * 1.12 - size / 2;
        // 120BPMで弾む（中央が高い弧に並べる）
        const y = cv.height * 0.62 - size / 2 - (1 - Math.abs(k) / n) * size * 0.5 - Math.abs(Math.sin(t * Math.PI * 2 + i * 1.05)) * size * 0.12;
        g.save(); g.translate(x + size / 2, y + size / 2); g.rotate(Math.sin(t * Math.PI + i) * 0.08); g.translate(-size / 2, -size / 2);
        RG.D.rrect(g, 3, 3, size, size, size * 0.2, '#0f0618');
        g.beginPath(); RG.D.rrect(g, 0, 0, size, size, size * 0.2); g.clip();
        RG.Games[id].drawIcon(g, size, size, t + i);
        g.restore();
      });
    };
    cancelAnimationFrame(App.titleRaf);
    App.titleRaf = requestAnimationFrame(loop);
  };

  // ---------- 選択画面 ----------
  App.buildSelect = function () {
    const list = $('game-list');
    list.innerHTML = '';
    const groups = [
      { title: 'リズムあそび', sub: 'まずはここから', ids: GAME_ORDER.filter(id => !RG.Games[id].sport) },
      { title: 'スポーツ・リズム', sub: '速い・裏拍だらけ・むずかしめ', ids: GAME_ORDER.filter(id => RG.Games[id].sport) }
    ];
    groups.forEach(gr => {
      if (!gr.ids.length) return;
      const h = document.createElement('div');
      h.className = 'group-head';
      h.innerHTML = `<span>${gr.title}</span><small>${gr.sub}</small>`;
      list.appendChild(h);
      gr.ids.forEach(id => list.appendChild(card(id)));
    });
  };
  function card(id) {
    const game = RG.Games[id], rec = RG.Storage.record(id);
    const el = document.createElement('div');
    el.className = 'game-card' + (game.sport ? ' sport' : '');
    const best = rec.best === null ? '―' : rec.best + '点';
    const hbest = rec.hardBest === null ? '―' : rec.hardBest + '点';
    const lv = '●'.repeat(game.level || 1) + '○'.repeat(5 - (game.level || 1));
    el.innerHTML = `
      <canvas width="152" height="152"></canvas>
      <h3>${game.title}</h3>
      <p class="how">${game.howto}</p>
      <div class="stat"><span class="lv" title="むずかしさ">${lv}</span>
        <span>最高 <b>${best}</b></span><span>ハード <b>${hbest}</b></span>
        ${rec.cleared ? '<span class="badge ok">★ クリア</span>' : ''}
        ${rec.hardCleared ? '<span class="badge hard">★ ハード</span>' : ''}
        ${rec.practiced ? '' : '<span class="badge rec">まずは練習</span>'}</div>
      <div class="btns">
        <button class="btn" data-mode="practice">練習</button>
        <button class="btn primary" data-mode="main">本編</button>
        <button class="btn hard" data-mode="hard">ハード</button>
      </div>`;
    game.drawIcon(el.querySelector('canvas').getContext('2d'), 152, 152, 0.3);
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const mode = b.dataset.mode;
      if (mode !== 'practice' && !rec.practiced && !rec.plays) { App._firstId = id; App._firstHard = mode === 'hard'; $('overlay-first').hidden = false; return; }
      if (mode === 'hard') App.startGame(id, 'main', { hard: true });
      else App.startGame(id, mode);
    }));
    return el;
  }

  // ---------- プレイ ----------
  App.startGame = async function (id, mode, opts = {}) {
    const token = App._startToken = (App._startToken || 0) + 1; // ボタンの連打で二重に始まらないように
    App.stopSession();
    try { await RG.Audio.resume(); } catch (e) { /* 失敗しても続行 */ }
    if (token !== App._startToken) return;
    App.last = { id, mode, opts };
    App.show('play');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Spaceキーでボタンが押されないように
    $('overlay-pause').hidden = true;
    $('overlay-loading').hidden = false;
    $('btn-skip').classList.toggle('show', mode === 'practice');
    App.guide(''); App.feedback(''); App.subInfo('');
    $('debug').hidden = !RG.Storage.settings.debug;
    await new Promise(r => setTimeout(r, 30));
    if (token !== App._startToken) return;
    App.stopSession();
    const s = new RG.Session(App, RG.Games[id], mode, opts);
    s.prepare();
    App.session = s;
    App.resizeCanvas();
    $('overlay-loading').hidden = true;
    s.start();
    s.updateInfo();
  };

  App.stopSession = function () {
    if (App.session) { App.session.stop(); App.session = null; }
  };

  App.restart = function () {
    if (!App.last) return App.show('select');
    const L = App.last;
    const opts = Object.assign({}, L.opts);
    if (L.mode === 'practice' && App._resumeLesson !== undefined) opts.lesson = App._resumeLesson;
    App._resumeLesson = undefined;
    App.startGame(L.id, L.mode, opts);
  };

  App.pause = function (title, msg) {
    const s = App.session;
    if (!s || App.screen !== 'play') return;
    if (s.practice) App._resumeLesson = Math.min(s.practice.li, s.game.lessons.length - 1);
    App.stopSession();
    $('pause-title').textContent = title || '一時停止';
    $('pause-msg').textContent = msg || '再開すると、カウントから最初にもどります';
    const canNext = s.mode === 'practice' && App._resumeLesson < s.game.lessons.length - 1;
    $('btn-next-lesson').hidden = !canNext;
    $('overlay-pause').hidden = false;
  };

  // バックグラウンドへ移動・音声の中断
  App.interrupt = function () {
    if (App.screen === 'play' && App.session && !App.session.finished) App.pause('中断しました', 'タップすると、カウント付きで最初から再開します');
    if (App.screen === 'calib') RG.Calib.stop();
  };

  App.guide = function (text) { $('guide').textContent = text || ''; };
  App.feedback = function (text, cls) {
    const f = $('feedback');
    f.textContent = text || '';
    f.className = 'feedback' + (cls ? ' ' + cls : '');
    if (text) { void f.offsetWidth; f.classList.add('pop'); }
  };
  App.subInfo = function (text) { $('sub-info').textContent = text || ''; };
  App.debug = function (text) { const d = $('debug'); d.hidden = false; d.textContent = text; };

  App.resizeCanvas = function () {
    const cv = $('cv'), st = $('stage');
    const r = st.getBoundingClientRect();
    App.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(r.width * App.dpr)), h = Math.max(1, Math.round(r.height * App.dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    App.g = cv.getContext('2d');
  };

  App.render = function (session, beat) {
    const cv = $('cv');
    const st = $('stage');
    if (Math.round(st.clientWidth * App.dpr) !== cv.width || Math.round(st.clientHeight * App.dpr) !== cv.height) App.resizeCanvas();
    const g = App.g, W = cv.width, H = cv.height;
    const s = Math.min(W / DESIGN_W, H / DESIGN_H);
    let ox = (W - DESIGN_W * s) / 2, oy = (H - DESIGN_H * s) / 2;
    // 締めの軽い揺れ（設定でオフにできる）
    const fin = session.chart.fx.find(f => f.type === 'finale');
    if (RG.Storage.settings.shake && fin && beat >= fin.beat && beat < fin.beat + 0.5) {
      const a = (1 - (beat - fin.beat) / 0.5) * 3 * s;
      ox += Math.sin(beat * 90) * a; oy += Math.cos(beat * 70) * a;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#20243f'; g.fillRect(0, 0, W, H);
    g.setTransform(s, 0, 0, s, ox, oy);
    const view = { x0: -ox / s, y0: -oy / s, x1: (W - ox) / s, y1: (H - oy) / s };
    session.scene.render(g, beat, view);
    // カウント表示
    for (const c of session.chart.cues) {
      if (c.beat > beat + 0.05) break;
      if (c.type === 'count' && beat - c.beat < 0.9) {
        const d = Math.max(0, beat - c.beat);
        g.save(); g.globalAlpha = 1 - d / 0.9; g.translate(180, 80); const k = 1.35 - 0.35 * RG.U.ease.outCubic(Math.min(1, d / 0.25)); g.scale(k, k);
        RG.D.circ(g, 0, 0, 34, 'rgba(255,255,255,0.18)');
        RG.D.text(g, String(c.n), 0, 2, 44, '#ffffff', 'rgba(0,0,0,0.45)');
        g.restore();
      }
    }
  };

  App.onMainEnd = function (session, res) {
    App.lastStats = { lateEvents: session.lateEvents || 0, maxClockErrMs: (session.maxClockErr || 0) * 1000, songTime: session.songTime() };
    const id = session.game.id;
    const rec = RG.Storage.record(id);
    const bk = session.hard ? 'hardBest' : 'best', ck = session.hard ? 'hardCleared' : 'cleared';
    const prevBest = rec[bk];
    rec.plays++;
    const isNew = prevBest === null || res.score > prevBest;
    if (isNew) rec[bk] = res.score;
    if (res.cleared) rec[ck] = true;
    res.hard = session.hard;
    RG.Storage.save();
    App.session = null;
    setTimeout(() => App.showResult(session.game, res, isNew, prevBest), 350);
  };

  App.showResult = function (game, res, isNew, prevBest) {
    App.show('result');
    $('res-game').textContent = game.title + (res.hard ? '（ハード）' : '');
    $('res-rank').textContent = res.rank.label;
    $('res-best').textContent = isNew ? (prevBest === null ? 'はじめての記録！' : `最高記録 更新！（前回まで ${prevBest}点）`) : `最高記録 ${prevBest}点`;
    $('res-best').classList.toggle('new', isNew);
    $('res-perfect').textContent = res.perfect;
    $('res-good').textContent = res.good;
    $('res-miss').textContent = res.miss;
    $('res-extra').textContent = res.extra;
    $('res-combo').textContent = res.maxCombo;
    $('res-total').textContent = res.total;
    const ul = $('res-advice'); ul.innerHTML = '';
    res.advice.forEach(a => { const li = document.createElement('li'); li.textContent = a; ul.appendChild(li); });
    // 点数のカウントアップ
    const el = $('res-score'), t0 = performance.now();
    const step = (ms) => {
      const k = Math.min(1, (ms - t0) / 900);
      el.textContent = Math.round(res.score * RG.U.ease.outCubic(k));
      if (k < 1 && App.screen === 'result') requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    App.jingle(res.rank.key);
    // 連打の流れで誤って押さないよう、少しだけボタンを無効に
    ['btn-retry', 'btn-res-select'].forEach(b => { $(b).disabled = true; setTimeout(() => { $(b).disabled = false; }, 800); });
  };

  App.jingle = function (key) {
    const A = RG.Audio; if (!A.ctx) return;
    const seqs = {
      superb: [['C5', 0], ['E5', 0.1], ['G5', 0.2], ['C6', 0.3], ['E6', 0.45], ['G6', 0.45]],
      great: [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.4]],
      ok: [['G4', 0], ['C5', 0.15], ['E5', 0.3]],
      try: [['E5', 0], ['D5', 0.16], ['G4', 0.32]]
    };
    const t = A.ctx.currentTime + 0.05;
    (seqs[key] || seqs.ok).forEach(([n, d]) => A.play(`marimba:${n}:0.9`, t + d, A.bus.sfx, 0.8));
    if (key === 'superb') A.play('chime', t + 0.45, A.bus.sfx, 0.8);
  };

  App.onPracticeEnd = function (session) {
    const rec = RG.Storage.record(session.game.id);
    rec.practiced = true;
    RG.Storage.save();
    App.session = null;
    setTimeout(() => App.showPracticeDone(session.game, true), 300);
  };
  App.showPracticeDone = function (game, cleared) {
    App.show('practice-done');
    $('pd-game').textContent = game.title;
    $('pd-title').textContent = cleared ? '練習クリア！' : '練習をスキップしました';
    $('pd-msg').textContent = cleared ? 'ルールはばっちり。本編で音に合わせて遊んでみよう！' : '練習は選択画面からいつでもできます。';
    App.lastGame = game.id;
  };

  // ---------- 設定 ----------
  App.syncSettings = function () {
    const S = RG.Storage.settings;
    ['master', 'bgm', 'cue', 'sfx'].forEach(k => { const el = $('vol-' + k); el.value = S.vol[k]; el.nextElementSibling.textContent = S.vol[k]; });
    $('in-offset-val').textContent = (S.inputOffsetMs > 0 ? '+' : '') + S.inputOffsetMs;
    $('vis-offset-val').textContent = (S.visualOffsetMs > 0 ? '+' : '') + S.visualOffsetMs;
    $('opt-vibe').checked = S.vibration;
    $('opt-shake').checked = S.shake;
    $('opt-debug').checked = S.debug;
    $('judge-perfect').value = S.judge.perfectMs;
    $('judge-good').value = S.judge.goodMs;
    $('judge-extra').value = S.judge.extraPenalty;
    $('audio-info').textContent = (RG.Audio.ctx ? RG.Audio.latencyInfo() : '') + (RG.Storage.available ? '' : ' ／ この環境では保存できません');
  };

  function bindSettings() {
    const S = () => RG.Storage.settings;
    ['master', 'bgm', 'cue', 'sfx'].forEach(k => {
      const el = $('vol-' + k);
      el.addEventListener('input', () => { S().vol[k] = +el.value; el.nextElementSibling.textContent = el.value; RG.Audio.applyVolumes(S().vol); });
      el.addEventListener('change', () => RG.Storage.save());
    });
    $('btn-vol-test').addEventListener('click', async () => {
      await RG.Audio.resume();
      const A = RG.Audio, t = A.ctx.currentTime + 0.05;
      A.play('koto:C5:0.8', t, A.bus.bgm); A.play('koto:E5:0.8', t + 0.25, A.bus.bgm);
      A.play('ton', t + 0.6, A.bus.cue); A.play('bell', t + 0.9, A.bus.cue);
      A.play('slap', t + 1.3, A.bus.sfx); A.play('sparkle', t + 1.3, A.bus.sfx);
    });
    document.querySelectorAll('[data-adj]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.adj === 'in' ? 'inputOffsetMs' : 'visualOffsetMs';
      S()[key] = RG.U.clamp(S()[key] + (+b.dataset.d), -300, 300);
      RG.Storage.save(); App.syncSettings();
    }));
    $('btn-offset-reset').addEventListener('click', () => { S().inputOffsetMs = 0; S().visualOffsetMs = 0; RG.Storage.save(); App.syncSettings(); App.toast('補正を 0ms に戻しました'); });
    $('opt-vibe').addEventListener('change', e => { S().vibration = e.target.checked; RG.Storage.save(); });
    $('opt-shake').addEventListener('change', e => { S().shake = e.target.checked; RG.Storage.save(); });
    $('opt-debug').addEventListener('change', e => { S().debug = e.target.checked; RG.Storage.save(); });
    const judgeInput = (id, key, lo, hi) => $(id).addEventListener('change', e => {
      const v = RG.U.clamp(+e.target.value || 0, lo, hi);
      S().judge[key] = v; e.target.value = v;
      if (S().judge.goodMs < S().judge.perfectMs) S().judge.goodMs = S().judge.perfectMs;
      RG.Storage.save(); App.syncSettings();
    });
    judgeInput('judge-perfect', 'perfectMs', 10, 150);
    judgeInput('judge-good', 'goodMs', 20, 200);
    judgeInput('judge-extra', 'extraPenalty', 0, 10);
    $('btn-judge-reset').addEventListener('click', () => {
      S().judge = { perfectMs: RG.CONFIG.judge.perfectMs, goodMs: RG.CONFIG.judge.goodMs, extraPenalty: RG.CONFIG.score.extraPenalty };
      RG.Storage.save(); App.syncSettings();
    });
    // 確認ダイアログを使わず、2回押しで確定（埋め込み表示でも動くように）
    $('btn-reset-records').addEventListener('click', e => {
      const b = e.currentTarget;
      if (b.dataset.armed) { RG.Storage.resetRecords(); delete b.dataset.armed; b.textContent = '記録をすべて消す'; App.toast('記録を消しました'); return; }
      b.dataset.armed = '1'; b.textContent = 'もう一度押すと消します（最高スコア・クリア・練習済み）';
      setTimeout(() => { delete b.dataset.armed; b.textContent = '記録をすべて消す'; }, 4000);
    });
    $('btn-calib').addEventListener('click', () => { App.show('calib'); RG.Calib.enter(); });
    $('btn-settings-back').addEventListener('click', () => App.show(App._settingsReturn || 'select'));
  }

  // ---------- 入力 ----------
  function bindInput() {
    const play = $('screen-play');
    // タップ（pointerdown のみを使う。click / touchend / mouse の互換イベントは使わないので二重入力にならない）
    play.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.target.closest('.overlay')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (App.session) App.session.input(RG.Audio.eventTime(e), e.pointerType || 'pointer');
    });
    // スクロール・拡大・長押しメニューの抑止
    play.addEventListener('touchstart', e => { if (!e.target.closest('button') && !e.target.closest('.overlay')) e.preventDefault(); }, { passive: false });
    play.addEventListener('contextmenu', e => e.preventDefault());
    $('screen-calib').addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      RG.Calib.input(RG.Audio.eventTime(e));
    });
    $('screen-calib').addEventListener('touchstart', e => { if (!e.target.closest('button')) e.preventDefault(); }, { passive: false });

    window.addEventListener('keydown', e => {
      const isTap = e.code === 'Space' || e.key === ' ';
      if (isTap && (App.screen === 'play' || App.screen === 'calib')) {
        e.preventDefault();
        if (e.repeat) return; // 長押しのキーリピートは無視
        if (App.screen === 'play' && App.session && $('overlay-pause').hidden) App.session.input(RG.Audio.eventTime(e), 'key');
        if (App.screen === 'calib') RG.Calib.input(RG.Audio.eventTime(e));
        return;
      }
      if (e.code === 'Escape' && App.screen === 'play' && !e.repeat) { if ($('overlay-pause').hidden) App.pause(); }
      if (e.key === 'd' && e.shiftKey) { // Shift + D：確認用表示の切り替え
        const S = RG.Storage.settings; S.debug = !S.debug; RG.Storage.save(); $('debug').hidden = !S.debug;
      }
    });
  }

  // プレイ中は Space の keyup でボタンが反応しないようにする
  window.addEventListener('keyup', e => {
    if ((e.code === 'Space' || e.key === ' ') && (App.screen === 'play' || App.screen === 'calib') && $('overlay-pause').hidden) e.preventDefault();
  });

  function bindButtons() {
    $('btn-start').addEventListener('click', async () => {
      RG.Audio.init();
      await RG.Audio.resume();
      App.show('select');
    });
    $('btn-first-practice').addEventListener('click', () => { $('overlay-first').hidden = true; App.startGame(App._firstId, 'practice'); });
    $('btn-first-main').addEventListener('click', () => { $('overlay-first').hidden = true; App.startGame(App._firstId, 'main', { hard: !!App._firstHard }); });
    $('btn-to-settings').addEventListener('click', () => { App._settingsReturn = 'select'; App.show('settings'); });
    $('btn-to-title').addEventListener('click', () => App.show('title'));
    $('btn-pause').addEventListener('pointerdown', e => e.stopPropagation());
    $('btn-pause').addEventListener('click', () => App.pause());
    $('btn-skip').addEventListener('click', () => {
      const s = App.session; if (!s) return;
      App.stopSession();
      App.showPracticeDone(s.game, false);
    });
    $('btn-restart').addEventListener('click', () => App.restart());
    $('btn-next-lesson').addEventListener('click', () => { App._resumeLesson = (App._resumeLesson || 0) + 1; App.restart(); });
    $('btn-quit').addEventListener('click', () => { $('overlay-pause').hidden = true; App.show('select'); });
    $('btn-retry').addEventListener('click', () => App.startGame(App.last.id, 'main', App.last.opts));
    $('btn-res-select').addEventListener('click', () => App.show('select'));
    $('btn-pd-main').addEventListener('click', () => App.startGame(App.lastGame, 'main'));
    $('btn-pd-again').addEventListener('click', () => App.startGame(App.lastGame, 'practice'));
    $('btn-pd-select').addEventListener('click', () => App.show('select'));
  }

  App.init = function () {
    RG.Storage.load();
    bindButtons();
    bindSettings();
    bindInput();
    window.addEventListener('resize', () => { if (App.screen === 'play') App.resizeCanvas(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) App.interrupt(); });
    window.addEventListener('pagehide', () => App.interrupt());
    RG.Audio.onState(state => { if (state === 'interrupted' || state === 'suspended') App.interrupt(); });
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => App.toast('音声機器が変わったようです。設定の「タイミング調整」をやり直すのがおすすめです', 5000));
    }
    App.show('title');
  };

  return App;
})();
