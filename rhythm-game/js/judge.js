/*
 * 入力判定（全ミニゲーム共通）
 *  - 1回の入力は、範囲内で未判定の対象のうち最も時刻が近い1つにだけ対応させる
 *  - 判定済みの対象は二度と採点しない
 *  - 押し忘れは判定期限を過ぎた時点で Miss
 *  - 対象のない時間の入力は「余分な入力」（active 区間内のみ。カウント中・お手本中・締めの後は減点しない）
 * 時刻はすべて「曲の再生位置（秒）」。入力時刻はタイミング調整値を差し引いたもの。
 */
RG.Judge = class Judge {
  constructor(chart, settings) {
    this.chart = chart;
    const j = settings.judge;
    this.perfect = j.perfectMs / 1000;
    this.good = Math.max(j.goodMs, j.perfectMs) / 1000;
    this.capture = Math.max(RG.CONFIG.judge.captureMs / 1000, this.good + 0.02);
    this.grace = RG.CONFIG.judge.expireGraceMs / 1000;
    this.extraPenalty = j.extraPenalty;
    this.s = { perfect: 0, good: 0, miss: 0, extra: 0, combo: 0, maxCombo: 0 };
    this.log = [];      // 入力の記録
    this.cursor = 0;    // ここより前の対象はすべて判定済み
  }

  inActive(t) {
    for (const r of this.chart.active) if (t >= r.from && t < r.to) return r;
    return null;
  }

  input(t, meta = {}) {
    const ins = this.chart.inputs;
    let best = null, bd = Infinity;
    for (let i = this.cursor; i < ins.length; i++) {
      const tg = ins[i];
      if (tg.time - t > this.capture) break;   // 対象は時刻順に並んでいる
      if (tg.judged || tg.demo) continue;
      const d = Math.abs(t - tg.time);
      if (d <= this.capture && d < bd) { best = tg; bd = d; }
    }
    let r;
    if (best) {
      const diff = t - best.time;
      const kind = bd <= this.perfect ? 'perfect' : bd <= this.good ? 'good' : 'miss';
      this.resolve(best, kind, diff, t);
      r = { kind, target: best, diff, t };
    } else if (this.inActive(t)) {
      this.s.extra++;
      this.s.combo = 0;
      r = { kind: 'extra', target: null, diff: null, t, region: this.inActive(t) };
    } else {
      r = { kind: 'ignored', target: null, diff: null, t };
    }
    this.log.push(Object.assign({ kind: r.kind, t, diff: r.diff, targetTime: r.target ? r.target.time : null }, meta));
    if (this.log.length > 400) this.log.shift();
    return r;
  }

  resolve(tg, kind, diff, at) {
    tg.judged = kind;
    tg.diff = diff;
    tg.at = at;
    if (kind === 'miss') { this.s.miss++; this.s.combo = 0; }
    else { this.s[kind]++; this.s.combo++; if (this.s.combo > this.s.maxCombo) this.s.maxCombo = this.s.combo; }
    this.advance();
  }
  advance() {
    const ins = this.chart.inputs;
    while (this.cursor < ins.length && (ins[this.cursor].judged || ins[this.cursor].demo)) this.cursor++;
  }

  // 期限切れ（押し忘れ）を Miss にする。新しく Miss になった対象を返す
  expire(t) {
    const out = [];
    const ins = this.chart.inputs;
    for (let i = this.cursor; i < ins.length; i++) {
      const tg = ins[i];
      if (tg.time + this.capture + this.grace > t) break;
      if (tg.judged || tg.demo) continue;
      this.resolve(tg, 'miss', null, null);
      out.push(tg);
    }
    this.advance();
    return out;
  }

  nextTarget(t) {
    const ins = this.chart.inputs;
    for (let i = this.cursor; i < ins.length; i++) if (!ins[i].judged && !ins[i].demo) return ins[i];
    return null;
  }

  // 100 ×（Perfect ＋ Good × 0.6）÷ 全判定対象数 − 余分な入力 × 1（0〜100に収めて四捨五入）
  result() {
    const total = this.chart.inputs.filter(x => !x.demo).length;
    const s = this.s;
    const raw = total ? 100 * (s.perfect + s.good * RG.CONFIG.score.goodWeight) / total : 0;
    const exact = RG.U.clamp(raw - s.extra * this.extraPenalty, 0, 100);
    const score = Math.round(exact);
    const rank = RG.CONFIG.ranks.find(r => score >= r.min);
    return {
      score, exact, rank, total,
      perfect: s.perfect, good: s.good, miss: s.miss, extra: s.extra, maxCombo: s.maxCombo,
      cleared: score >= RG.CONFIG.clearScore,
      advice: this.advice()
    };
  }

  // 入力記録にもとづく短いアドバイス（データが少ないときは傾向を出さない）
  advice() {
    const A = RG.CONFIG.advice;
    const real = this.chart.inputs.filter(x => !x.demo);
    const diffs = real.filter(x => x.diff !== null).map(x => x.diff * 1000);
    const out = [];
    const forgot = real.filter(x => x.judged === 'miss' && x.diff === null).length;
    if (diffs.length >= A.minSamples) {
      const m = RG.U.mean(diffs), sd = RG.U.stdev(diffs);
      if (m < -A.biasMs) out.push(`少し早めに押す傾向があります（平均 ${Math.round(-m)}ms 早い）`);
      else if (m > A.biasMs) out.push(`少し遅れて押す傾向があります（平均 ${Math.round(m)}ms 遅い）`);
      else if (sd < A.steadyMs) out.push('タイミングがとても安定しています！');
      else out.push('平均はぴったり。合図の音をよく聴くと、さらにそろいます');
      if (Math.abs(m) > A.calibSuggestMs) out.push('毎回同じ方向にずれる場合は、設定の「タイミング調整」を試してください');
    }
    if (real.length && forgot / real.length > 0.25) out.push('押し忘れが多めです。合図のあとの拍を心の中で数えてみよう');
    if (this.s.extra >= 5) out.push('合図のないところで押しています。押すのは決まった拍だけ！');
    return out.slice(0, 3);
  }
};

// 早い／ぴったり／遅い
RG.Judge.timingLabel = function (kind, diff, perfect) {
  if (diff === null || diff === undefined) return { text: '押し忘れ', cls: 'late' };
  if (Math.abs(diff) <= perfect) return { text: 'ぴったり！', cls: 'just' };
  return diff < 0 ? { text: kind === 'miss' ? '早すぎ' : '早い', cls: 'early' } : { text: kind === 'miss' ? '遅すぎ' : '遅い', cls: 'late' };
};
