/*
 * 1回のプレイ（本編・練習共通）
 *  - 音：曲の開始時刻 startAt（ctx 時刻）を基準に、先読みスケジューラで予約再生
 *  - 判定：入力の timeStamp → heard 時刻 → 曲の再生位置 → タイミング補正を引いて judge へ
 *  - 描画：毎フレーム heard 時刻から曲の再生位置を求め、映像補正を引いた拍でシーンを描く
 *    （フレーム数や待ち時間の積み重ねは使わないので、描画が遅れても曲と判定はずれない）
 */
RG.Session = class Session {
  constructor(app, game, mode, opts = {}) {
    this.app = app;
    this.game = game;
    this.mode = mode;            // 'main' | 'practice'
    this.opts = opts;
    this.settings = RG.Storage.settings;
    this.hard = mode === 'main' && !!opts.hard && !!game.hard;
    this.chart = new RG.Chart(game, this.hard ? { bpm: game.hard.bpm } : {});
    this.judge = new RG.Judge(this.chart, this.settings);
    this.events = [];
    this.evIdx = 0;
    this.visIdx = 0;
    this.running = false;
    this.finished = false;
    this.lastRaw = -1e9;
    this.lastInput = null;
    this.extraLog = [];
    this.guideText = null;
    this.frameBound = () => this.frame();
    if (mode === 'main') (this.hard ? game.hard.main : game.main).forEach(tok => this.chart.place(tok));
    else this.practice = new RG.Practice(this, opts.lesson || 0);
    this.scene = game.createScene(this);
    if (RG.DEV) { const p = this.chart.validate(); if (p.length) console.warn('[chart]', p); }
  }

  get spb() { return this.chart.spb; }
  get inOff() { return (this.settings.inputOffsetMs || 0) / 1000; }
  get visOff() { return (this.settings.visualOffsetMs || 0) / 1000; }

  // 再生前に必要な音をすべて用意する
  prepare() {
    this.pullAudio();
    const ids = new Set(this.events.map(e => e.id));
    (this.game.preload ? this.game.preload(this.chart) : []).forEach(id => ids.add(id));
    ['tap', 'miss', 'stick'].forEach(id => ids.add(id));
    RG.Audio.preload([...ids]);
  }

  start() {
    const A = RG.Audio;
    this.sb = A.createSessionBus();
    A.resetClock();
    this.startAt = A.ctx.currentTime + RG.CONFIG.audio.startLead;
    this.running = true;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), RG.CONFIG.audio.intervalMs);
    this.raf = requestAnimationFrame(this.frameBound);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    RG.Audio.destroySessionBus(this.sb);
    this.sb = null;
  }

  pullAudio() {
    const q = this.chart.drainAudio();
    if (!q.length) return;
    const rest = this.events.splice(this.evIdx).concat(q).sort((a, b) => a.time - b.time);
    this.events.push(...rest);
  }

  schedule() {
    if (!this.running) return;
    this.pullAudio();
    const A = RG.Audio, now = A.ctx.currentTime, horizon = now + RG.CONFIG.audio.lookahead;
    while (this.evIdx < this.events.length) {
      const e = this.events[this.evIdx];
      const when = this.startAt + e.time;
      if (when > horizon) break;
      if (when < now) this.lateEvents = (this.lateEvents || 0) + 1; // 予約が間に合わなかった音（確認用）
      if (when >= now - 0.05) A.play(e.id, when, this.sb[e.bus], e.gain, this.sb);
      this.evIdx++;
    }
  }

  // 曲の再生位置（今スピーカーから聞こえている位置、秒）
  songTime() { return RG.Audio.heardNow() - this.startAt; }

  playNow(id, gain = 1, bus = 'sfx') {
    if (!this.sb) return;
    RG.Audio.play(id, RG.Audio.ctx.currentTime, this.sb[bus], gain, this.sb);
  }

  // 少しあとに鳴らす効果音（ボールがカップに入る音など）。予約するので音の時計どおりに鳴る
  playLater(id, delaySec, gain = 1, bus = 'sfx') {
    if (!this.sb) return;
    RG.Audio.play(id, RG.Audio.ctx.currentTime + delaySec, this.sb[bus], gain, this.sb);
  }

  input(tsMs, src) {
    if (!this.running || this.finished) return;
    const raw = RG.Audio.perfToHeard(tsMs) - this.startAt;
    if (raw - this.lastRaw < RG.CONFIG.judge.doubleInputGuardMs / 1000) return; // 二重入力の防止
    this.lastRaw = raw;
    const t = raw - this.inOff;                       // 判定に使う時刻（入力補正）
    const vbeat = this.chart.beatAt(raw - this.visOff); // 演出に使う拍（映像補正）
    const r = this.judge.input(t, { src });
    this.lastInput = r;
    if (r.kind === 'perfect' || r.kind === 'good') {
      this.game.hitSounds(r.target, r.kind, this.chart).forEach(s => this.playNow(s.id, s.gain));
      if (this.settings.vibration && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    } else if (r.kind === 'miss') {
      this.playNow(this.game.missSound || 'miss', 0.9);
    } else if (r.kind === 'extra') {
      this.playNow('tap', 0.9);
      r.region.inst.extra = (r.region.inst.extra || 0) + 1;
      this.extraLog.push(r.t);
    } else {
      this.playNow('tap', 0.5);
    }
    if (r.target) this.scene.onJudge(r.target, r.kind, vbeat, r);
    this.scene.onTap && this.scene.onTap(vbeat, r);
    this.showFeedback(r);
    this.updateInfo();
  }

  showFeedback(r) {
    if (this.mode !== 'practice') return;
    if (r.kind === 'extra') { this.app.feedback('よけいなタップ', 'late'); return; }
    if (!r.target || r.target.demo) return;
    const L = RG.Judge.timingLabel(r.kind, r.diff, this.judge.perfect);
    this.app.feedback(L.text, L.cls);
  }

  updateInfo() {
    if (this.mode === 'practice') this.app.subInfo(this.practice.infoText());
    else {
      const c = this.judge.s.combo;
      this.app.subInfo(c >= 10 ? `ノリノリ！ ${c} コンボ` : c >= 2 ? `${c} コンボ` : '');
    }
  }

  frame() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frameBound);
    const A = RG.Audio;
    A.updateClock();
    this.schedule();
    // 映像用の時計（ならした値）と音声出力の時計の差。後半でも広がらないことの確認用
    if (A._rawOff !== null) this.maxClockErr = Math.max(this.maxClockErr || 0, Math.abs(A._off - A._rawOff));
    const raw = this.songTime();
    const t = raw - this.inOff;
    const tv = raw - this.visOff;
    const beatV = this.chart.beatAt(tv);

    // 押し忘れ → Miss。期限の判定は「前のフレームの時刻」で行う：
    // 主スレッドが一時的に止まった場合でも、その間に溜まった入力イベントが先に処理されてから期限切れを判断できる
    const missed = this.prevT === undefined ? [] : this.judge.expire(this.prevT);
    this.prevT = t;
    if (missed.length) {
      missed.forEach(tg => this.scene.onJudge(tg, 'miss', beatV, { kind: 'miss', target: tg, diff: null }));
      this.playNow(this.game.missSound || 'miss', 0.8);
      if (this.mode === 'practice') this.app.feedback('押し忘れ', 'late');
      this.updateInfo();
    }
    // お手本（自動演奏）の演出。音はスケジューラで予約済み
    const ins = this.chart.inputs;
    while (this.visIdx < ins.length && ins[this.visIdx].time <= tv) {
      const tg = ins[this.visIdx++];
      if (tg.demo && !tg.judged) { tg.judged = 'demo'; this.scene.onJudge(tg, 'perfect', tg.beat, { kind: 'perfect', demo: true }); }
    }
    if (this.practice) this.practice.update(t, beatV);

    // 上部の案内
    const g = this.chart.guideAt(beatV);
    const text = g ? g.text : '';
    if (text !== this.guideText) { this.guideText = text; this.app.guide(text); }

    this.app.render(this, beatV, tv);
    if (this.settings.debug) this.app.debug(this.debugText(raw, t, beatV));

    if (this.chart.endBeat !== null && beatV >= this.chart.endBeat && !this.finished) this.finish();
  }

  finish() {
    this.finished = true;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.running = false;
    const sb = this.sb;
    setTimeout(() => RG.Audio.destroySessionBus(sb), 2500); // 締めの余韻だけ残す
    this.sb = null;
    if (this.mode === 'main') this.app.onMainEnd(this, this.judge.result());
    else this.app.onPracticeEnd(this);
  }

  debugText(raw, t, beat) {
    const nt = this.judge.nextTarget(t);
    const li = this.lastInput;
    const f = x => (x === null || x === undefined ? '-' : x.toFixed(3));
    const ms = x => (x === null || x === undefined ? '-' : (x >= 0 ? '+' : '') + Math.round(x * 1000) + 'ms');
    const s = this.judge.s;
    return [
      `曲の時刻   ${f(raw)} s`,
      `判定時刻   ${f(t)} s (入力補正 ${this.settings.inputOffsetMs}ms)`,
      `拍(映像)   ${beat.toFixed(2)}  小節 ${Math.floor(beat / 4) + 1}`,
      `次の対象   ${nt ? f(nt.time) + ' s / ' + nt.beat + '拍' : '-'}`,
      `入力時刻   ${li ? f(li.t) : '-'}`,
      `差         ${li ? ms(li.diff) : '-'}`,
      `判定       ${li ? li.kind : '-'}`,
      `P${s.perfect} G${s.good} M${s.miss} 余分${s.extra} combo${s.combo}`,
      `余分な入力 ${this.extraLog.slice(-4).map(x => x.toFixed(2)).join(', ') || '-'}`,
      `予約済み音 ${this.evIdx}/${this.events.length}  再生中 ${this.sb ? this.sb.sources.size : 0}  遅れ ${this.lateEvents || 0}`,
      `時計の誤差 最大 ${((this.maxClockErr || 0) * 1000).toFixed(1)}ms`,
      RG.Audio.latencyInfo()
    ].join('\n');
  }
};

/* 練習モード：お手本 → プレイヤーの実践。2回連続成功で次の課題へ */
RG.Practice = class Practice {
  constructor(session, startLesson) {
    this.s = session;
    this.chart = session.chart;
    this.lessons = session.game.lessons;
    this.li = Math.min(startLesson, this.lessons.length - 1);
    this.streak = 0;
    this.fails = 0;
    this.trialN = 0;
    this.pending = null;
    this.done = false;
    const C = RG.CONFIG.practice;
    this.need = C.needStreak;
    this.chart.place({ p: 'count', sec: 'count', guide: 'れんしゅう　はじめるよ' });
    this.beginLesson(true);
  }
  get lesson() { return this.lessons[this.li]; }

  beginLesson(first) {
    const L = this.lesson, sec = L.sec || 'P';
    this.chart.place({ p: 'rest', sec, guide: `課題${this.li + 1}/${this.lessons.length}「${L.title}」` });
    this.placeDemo(RG.CONFIG.practice.demoReps);
    this.placeTrial();
  }
  placeDemo(n) {
    const L = this.lesson, sec = this.lesson.sec || 'P';
    for (let k = 0; k < n; k++) this.chart.place({ p: L.p, sec, demo: true, guide: k === 0 ? `お手本：${L.hint}` : 'お手本をもう1回　→ つぎは きみの番' });
  }
  placeTrial() {
    const L = this.lesson, sec = L.sec || 'P';
    const id = ++this.trialN;
    const inst = this.chart.place({ p: L.p, sec, trial: id, guide: this.streak ? 'その調子！もう1回' : 'きみの番！' });
    const gap = this.chart.place({ p: 'rest', sec });
    this.pending = { inst, gap, end: this.chart.t(inst.end) };
  }

  update(t) {
    const P = this.pending;
    if (!P || this.done) return;
    if (t < P.end + 0.03) return;
    if (!P.inst.targets.every(x => x.judged)) return;
    this.pending = null;
    this.evaluate(P);
  }

  evaluate(P) {
    const inst = P.inst;
    const allHit = inst.targets.every(x => x.judged === 'perfect' || x.judged === 'good');
    const extra = inst.extra || 0;
    const say = (text) => this.chart.guides.push({ beat: P.gap.start, text });
    if (allHit && !extra) {
      this.streak++; this.fails = 0;
      if (this.streak >= this.need) {
        this.streak = 0;
        this.li++;
        this.s.playNow('chime', 0.9);
        if (this.li >= this.lessons.length) {
          say('ぜんぶクリア！');
          this.done = true;
          this.chart.place({ p: this.s.game.finalePattern || 'fin', sec: 'end' });
          return;
        }
        say('クリア！ つぎの課題へ');
        this.beginLesson(false);
      } else {
        say(`せいこう！ あと${this.need - this.streak}回`);
        this.placeTrial();
      }
    } else {
      this.streak = 0; this.fails++;
      const forgot = inst.targets.some(x => x.judged === 'miss' && x.diff === null);
      const ds = inst.targets.filter(x => x.diff !== null && x.judged !== 'perfect').map(x => x.diff);
      let why = 'おしい！ もう一度';
      if (extra) why = 'よけいなタップがあったよ。もう一度';
      else if (forgot) why = '押し忘れがあったよ。もう一度';
      else if (ds.length && RG.U.mean(ds) < 0) why = 'ちょっと早かった！ もう一度';
      else if (ds.length) why = 'ちょっと遅かった！ もう一度';
      say(why);
      if (this.fails >= RG.CONFIG.practice.reDemoAfterFails) { this.fails = 0; this.placeDemo(1); }
      this.placeTrial();
    }
    this.s.updateInfo();
  }

  infoText() {
    const dots = Array.from({ length: this.need }, (_, i) => (i < this.streak ? '●' : '○')).join(' ');
    return this.done ? '練習完了！' : `課題 ${Math.min(this.li + 1, this.lessons.length)}/${this.lessons.length}　連続成功 ${dots}`;
  }
};
