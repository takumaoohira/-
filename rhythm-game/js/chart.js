/*
 * 譜面（ステージデータ）
 *
 * ステージデータは次の要素を分けて持ちます（各ゲームの js/games/*.js に記述）：
 *   bpm      … テンポ
 *   offset   … 楽曲開始オフセット（秒）。曲の再生開始から「0拍目」までの時間
 *   patterns … リズムパターン。cues（合図の拍位置と種類）/ inputs（入力の拍位置）/ fx（演出の種類）/ active（減点対象の区間）
 *   main     … 本編のパターンの並び（セクション名つき）
 *   music()  … 小節ごとのBGM
 * 判定処理（judge.js）は拍→秒に変換された targets だけを見るので、曲やリズムを変えても判定処理は書き換え不要です。
 */
RG.Chart = class Chart {
  constructor(game) {
    this.game = game;
    this.bpm = game.bpm;
    this.spb = 60 / game.bpm;
    this.offset = game.offset || 0;
    this.cursor = 0;          // 次に置く拍
    this.cues = [];
    this.inputs = [];
    this.fx = [];
    this.active = [];          // [{from,to}] 秒。余分な入力を減点する区間
    this.guides = [];          // [{beat, text}]
    this.instances = [];       // 置いたパターンの記録
    this.bars = [];            // 小節ごとの情報 {sec, secBar, chord}
    this.secCount = {};
    this.audioQueue = [];      // セッションに渡す前の音イベント
    this.endBeat = null;
    this._id = 0;
  }
  t(beat) { return this.offset + beat * this.spb; }
  beatAt(time) { return (time - this.offset) / this.spb; }

  pattern(name) {
    if (name === 'count') return Chart.COUNT;
    if (name === 'rest') return Chart.REST;
    const p = this.game.patterns[name];
    if (!p) throw new Error('unknown pattern ' + name);
    return p;
  }

  // tok: { p: パターン名, sec: 楽曲セクション, guide: 上部の案内, demo: お手本（自動演奏・採点なし）, trial: 練習の試行ID }
  place(tok) {
    const pat = this.pattern(tok.p);
    const base = this.cursor;
    const len = pat.len || 4;
    const inst = { id: ++this._id, p: tok.p, start: base, end: base + len, demo: !!tok.demo, trial: tok.trial || null, tok, targets: [], cues: [] };

    // 小節ごとのBGM
    for (let b = 0; b < len; b += 4) {
      const barIdx = Math.round((base + b) / 4);
      const sec = tok.sec || (tok.p === 'count' ? 'count' : 'A');
      const secBar = this.secCount[sec] = (this.secCount[sec] === undefined ? 0 : this.secCount[sec] + 1);
      const info = { bar: barIdx, sec, secBar, beat: base + b, chord: this.game.chordFor ? this.game.chordFor(sec, secBar) : null };
      this.bars[barIdx] = info;
      const evs = this.game.music(info, this) || [];
      evs.forEach(e => this.queue(base + b + e.b, e.id, e.bus || 'bgm', e.gain));
    }

    // 入力（判定対象）
    (pat.inputs || []).forEach((p, k) => {
      const beat = base + p.b;
      const tg = { id: ++this._id, beat, time: this.t(beat), type: p.type || 'hit', k, inst, demo: inst.demo, trial: inst.trial, judged: null, diff: null, at: null, vbeat: null, data: p.data || null };
      this.inputs.push(tg);
      inst.targets.push(tg);
      if (inst.demo) this.game.hitSounds(tg, 'perfect', this).forEach(s => this.queue(beat, s.id, 'sfx', s.gain));
    });
    // 合図
    (pat.cues || []).forEach(c => {
      const beat = base + c.b;
      const cue = { beat, time: this.t(beat), type: c.type, who: c.who || null, n: c.n, inst, target: c.for !== undefined ? inst.targets[c.for] : null };
      this.cues.push(cue);
      inst.cues.push(cue);
      const snd = (pat === Chart.COUNT ? Chart.COUNT_SOUNDS : this.game.cueSounds)[c.type];
      if (snd) (Array.isArray(snd) ? snd : [snd]).forEach(s => this.queue(beat + (s.d || 0), s.id || s, 'cue', s.gain || 1));
    });
    (pat.fx || []).forEach(f => this.fx.push({ beat: base + f.b, type: f.type, inst }));
    if (tok.guide) this.guides.push({ beat: base + (tok.guideAt || 0), text: tok.guide });

    if (!inst.demo && pat.active !== false && (pat.inputs || []).length) {
      const a = pat.active || [0, len];
      this.active.push({ from: this.t(base + a[0]), to: this.t(base + a[1]), inst });
    }
    if (pat.end) this.endBeat = base + len;
    this.instances.push(inst);
    this.cursor += len;
    return inst;
  }

  queue(beat, id, bus, gain = 1) {
    this.audioQueue.push({ time: this.t(beat), beat, id, bus, gain });
  }
  drainAudio() {
    const q = this.audioQueue;
    this.audioQueue = [];
    return q.sort((a, b) => a.time - b.time);
  }
  barAt(beat) { return this.bars[Math.floor(beat / 4)] || null; }
  guideAt(beat) {
    let g = null;
    for (const x of this.guides) { if (x.beat <= beat + 1e-6) g = x; else break; }
    return g;
  }
  instanceAt(beat) {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const s = this.instances[i];
      if (beat >= s.start && beat < s.end) return s;
    }
    return null;
  }
  // 判定対象どうしが近すぎないか（開発時のチェック）
  validate() {
    const problems = [];
    const real = this.inputs.slice().sort((a, b) => a.time - b.time);
    for (let i = 1; i < real.length; i++) {
      if (real[i].time - real[i - 1].time < 0.24) problems.push(`入力が近すぎます: ${real[i - 1].beat}拍 と ${real[i].beat}拍`);
    }
    if (this.game.validate) problems.push(...this.game.validate(this));
    return problems;
  }
};

// 開始前の4拍カウント
RG.Chart.COUNT = { len: 4, active: false, cues: [1, 2, 3, 4].map((n, i) => ({ b: i, type: 'count', n })), inputs: [] };
RG.Chart.COUNT_SOUNDS = { count: { id: 'stick', gain: 0.9 } };
RG.Chart.REST = { len: 4, cues: [], inputs: [] };
