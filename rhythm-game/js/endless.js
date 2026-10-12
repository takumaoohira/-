/*
 * エンドレスモード（いまはピンポン・ファンクのみ。ゲーム側の game.endless に設定を書く）
 *  - 譜面は先へ先へと自動で組み立てる（いまの拍より12拍ぶん先まで）
 *  - レベルは barsPerLevel 小節ごとに上がる。テンポは bpm0 + bpmStep ×（レベル−1）で、上限なし
 *  - レベルが上がるたびに「レベルアップ」の小節（新しいテンポのカウント付き）→ 金色のチャンスボール（得点2倍）
 *  - 得点：Perfect 100／Good 50 × レベル倍率（1 + 0.25×(レベル−1)）× コンボ倍率（1 + 0.02×コンボ、50コンボで最大2倍）
 *          チャンスボールはさらに ×2
 *  - ライフ3。Miss で1つ減る（チャンスボールの Miss は減らない）。レベルアップで1つ回復。0でゲームオーバー
 * テンポが変わっても、判定は「拍→秒」に変換した時刻だけを見るので、判定処理は本編と同じものを使う。
 */
(function () {
RG.Endless = class Endless {
  constructor(session) {
    this.s = session;
    this.chart = session.chart;
    this.game = session.game;
    this.cfg = session.game.endless;
    this.chart.endless = this;
    this.level = 0;           // 譜面を置き終えたレベル（プレイヤーより先に進む）
    this.lives = this.cfg.lives;
    this.score = 0;
    this.shown = 0;           // 画面に出している点数（カウントアップ）
    this.chance = { hit: 0, total: 0 };
    this.levels = [];         // [{level, beat, bpm, chance, applied}]
    this.pops = [];           // 得点の吹き出し [{beat, text, sub, gold}]
    this.over = false;
    this.overBeat = null;
    this.hurtBeat = -99;
    this.left = 0;
    this.recent = [];
    this.seed = ((session.opts && session.opts.seed) || (Date.now() & 0xffffff) || 1) >>> 0;
    this.chart.place({ p: 'count', sec: 'count', guide: this.cfg.intro });
    this.fill(0);
  }

  rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  bpmOf(L) { return this.cfg.bpm0 + this.cfg.bpmStep * (L - 1); }
  levelAt(beat) { let L = 1; for (const x of this.levels) { if (x.beat <= beat) L = x.level; else break; } return L; }
  sinceLevelUp(beat) { let d = 99; for (const x of this.levels) { if (x.beat <= beat) d = beat - x.beat; else break; } return d; }
  get reached() { let L = 1; for (const x of this.levels) if (x.applied) L = x.level; return L; }
  comboMult(combo) { return 1 + Math.min(combo, 50) * 0.02; }
  levelMult(L) { return 1 + 0.25 * (L - 1); }

  // いまの拍の12拍先まで譜面を置く
  fill(beat) {
    const c = this.chart, before = c.audioQueue.length;
    while (!this.over && c.cursor < beat + 12) {
      if (this.left <= 0) this.nextLevel();
      else { this.placeRally(); this.left--; }
    }
    // 新しいテンポで初めて使う音は、鳴らす前に作っておく（予約の時点で作ると処理が詰まることがある）
    if (c.audioQueue.length > before && RG.Audio.ctx) RG.Audio.preload(c.audioQueue.slice(before).map(e => e.id));
  }

  nextLevel() {
    const c = this.chart, cfg = this.cfg;
    const L = ++this.level, bpm = this.bpmOf(L);
    if (L > 1) c.setTempo(bpm);
    c.endlessHeat = L - 1;
    const tip = cfg.tips && cfg.tips[L];
    const inst = c.place(L === 1
      ? { p: 'rest', sec: 'I', level: L, guide: 'レベル1　コン・ポッ・カン（1拍あと）' }
      : { p: cfg.levelPattern, sec: 'I', level: L, guide: tip ? `レベル${L}！ ${tip}` : `レベル${L}！ テンポアップ` });
    const lv = { level: L, beat: inst.start, bpm, chance: L >= cfg.chanceFrom, applied: false };
    this.levels.push(lv);
    if (lv.chance) c.place({ p: cfg.chancePattern, sec: this.sec(L), level: L, guide: '金色のチャンスボール！ 2拍あと・得点2倍' });
    this.left = cfg.barsPerLevel;
    this.levelGuide = `LEVEL ${L}　BPM ${bpm}`;
  }

  sec(L) { const s = this.cfg.secs; return s[(L - 1) % s.length]; }

  // レベルに合ったむずかしさのパターンを選ぶ（新しく出てきたパターンは出やすく、同じものの連続は出にくく）
  placeRally() {
    const L = this.level, target = Math.min(4, (L - 1) * 0.45);
    const cand = this.cfg.pool.filter(p => p[1] <= L).map(([p, from, d]) => {
      let w = Math.exp(-1.2 * Math.abs(d - target));
      if (from === L) w *= 3;
      if (this.recent[0] === p) w *= 0.25;
      if (this.recent[1] === p) w *= 0.5;
      return { p, w };
    });
    let r = this.rand() * cand.reduce((a, x) => a + x.w, 0), pick = cand[0].p;
    for (const x of cand) { r -= x.w; if (r <= 0) { pick = x.p; break; } }
    this.recent.unshift(pick); this.recent.length = 2;
    this.chart.place({ p: pick, sec: this.sec(L), level: L, guide: this.levelGuide });
    this.levelGuide = null;
  }

  // 毎フレーム
  update(t, beat) {
    this.fill(beat);
    for (const x of this.levels) {
      if (x.applied || beat < x.beat) continue;
      x.applied = true;
      if (x.level > 1 && !this.over && this.lives < this.cfg.lives) { this.lives++; this.pops.push({ beat, text: 'LIFE +1', sub: '', heart: true }); }
    }
    const d = this.score - this.shown;
    this.shown = d <= 0 ? this.score : this.shown + Math.max(1, Math.ceil(d * 0.18));
    this.pops = this.pops.filter(p => beat - p.beat < 2);
  }

  // 判定のたびに呼ばれる（input／押し忘れ）
  onResult(tg, kind, beat) {
    if (this.over || !tg || tg.demo) return;
    const L = (tg.inst && tg.inst.tok.level) || 1, isCh = tg.type === 'chance';
    if (isCh) this.chance.total++;
    if (kind === 'miss') {
      if (isCh) { this.pops.push({ beat, text: 'チャンス逃し…', sub: '', miss: true }); return; }
      this.lives--;
      this.hurtBeat = beat;
      if (this.lives <= 0) this.gameOver(beat);
      return;
    }
    if (isCh) this.chance.hit++;
    const combo = this.s.judge.s.combo;
    const pts = Math.round((kind === 'perfect' ? 100 : 50) * this.levelMult(L) * this.comboMult(combo) * (isCh ? 2 : 1) / 10) * 10;
    this.score += pts;
    this.pops.push({ beat, text: `+${pts}`, sub: isCh ? '×2 CHANCE!' : kind === 'perfect' ? 'PERFECT' : 'GOOD', gold: isCh });
    if (combo === this.cfg.feverCombo) this.s.quip('fever');
  }

  gameOver(beat) {
    this.over = true;
    this.overBeat = beat;
    const s = this.s, c = this.chart, A = RG.Audio;
    // まだ予約していない音は捨て、曲と合図はすっと消す（効果音と声は残す）
    s.events.length = s.evIdx;
    if (s.sb && A.ctx) {
      const now = A.ctx.currentTime;
      ['bgm', 'cue', 'rev'].forEach(k => { const g = s.sb[k].gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(0, now, 0.06); });
      A.play('boom', now + 0.02, s.sb.sfx, 0.7, s.sb);
      [['E5', 0.15], ['D5', 0.33], ['B4', 0.51], ['G4', 0.69]].forEach(([n, d]) => A.play(`marimba:${n}:0.6`, now + d, s.sb.sfx, 0.7, s.sb));
      A.play('voice:gorilla:ゲームオーバー', now + 0.9, s.sb.voice, 0.95, s.sb, 0, 0.15);
    }
    c.bubbles.push({ beat: c.beatAt(c.t(beat) + 0.9), text: 'ゲームオーバー', who: 'gorilla', len: c.beatAt(c.t(beat) + 2.6) - c.beatAt(c.t(beat) + 0.9) });
    c.endBeat = c.beatAt(c.t(beat) + 3.2);
  }

  result() {
    const j = this.s.judge.s;
    const judged = this.chart.inputs.filter(x => !x.demo && x.judged && x.judged !== 'demo').length;
    const adv = [];
    if (this.chance.total) adv.push(`チャンスボール ${this.chance.hit}/${this.chance.total} 成功` + (this.chance.hit === this.chance.total ? '　パーフェクト！' : ''));
    adv.push(...this.s.judge.advice());
    return {
      endless: true, score: this.score, level: this.reached, bpm: this.bpmOf(this.reached), chance: Object.assign({}, this.chance),
      perfect: j.perfect, good: j.good, miss: j.miss, extra: j.extra, maxCombo: j.maxCombo, total: judged, advice: adv
    };
  }

  infoText() {
    const c = this.s.judge.s.combo;
    if (this.over) return 'ゲームオーバー';
    return c >= this.cfg.feverCombo ? `FEVER！ ${c} コンボ　×${this.comboMult(c).toFixed(2)}` : c >= 2 ? `${c} コンボ　×${this.comboMult(c).toFixed(2)}` : '';
  }

  // ---------------- 画面の上に重ねる表示（スコア・ライフ・レベルアップ・ゲームオーバー） ----------------
  draw(g, beat, view) {
    const D = RG.D, U = RG.U;
    const combo = this.s.judge.s.combo, fever = combo >= this.cfg.feverCombo && !this.over;
    const W = view.x1 - view.x0, H = view.y1 - view.y0;
    // フィーバー：画面のふちが光る
    if (fever) {
      const a = 0.35 + 0.25 * U.hop(beat);
      g.save(); g.lineWidth = 10; g.strokeStyle = `rgba(255,122,217,${a})`; g.strokeRect(view.x0 + 5, view.y0 + 5, W - 10, H - 10);
      g.lineWidth = 3; g.strokeStyle = `rgba(122,255,224,${a})`; g.strokeRect(view.x0 + 12, view.y0 + 12, W - 24, H - 24); g.restore();
    }
    // ライフが最後の1つ：赤いふち
    if (this.lives === 1 && !this.over) {
      const a = 0.35 + 0.25 * U.hop(beat);
      const rg = g.createRadialGradient(180, 270, 110, 180, 270, 360);
      rg.addColorStop(0, 'rgba(255,0,40,0)'); rg.addColorStop(1, `rgba(255,0,40,${a})`);
      g.fillStyle = rg; g.fillRect(view.x0, view.y0, W, H);
    }
    // Miss の瞬間：赤く光る
    const dh = beat - this.hurtBeat;
    if (dh >= 0 && dh < 0.5) { g.fillStyle = `rgba(255,30,60,${0.3 * (1 - dh / 0.5)})`; g.fillRect(view.x0, view.y0, W, H); }

    // 上部：スコアとライフ
    const y = Math.max(view.y0 + 6, -70);
    D.rrect(g, 8, y, 344, 46, 12, 'rgba(11,6,18,.82)', '#ffc93a', 2);
    D.text(g, 'SCORE', 22, y + 14, 10, '#ffc93a', null, 'left', 900);
    D.text(g, String(this.shown).padStart(7, '0'), 22, y + 32, 22, '#ffffff', null, 'left', 900);
    const L = this.levelAt(beat);
    D.rrect(g, 150, y + 8, 64, 30, 8, '#ff3d6e', '#2b1640', 2);
    D.text(g, `Lv ${L}`, 182, y + 24, 16, '#ffffff', null, 'center', 900);
    for (let k = 0; k < this.cfg.lives; k++) {
      const on = k < this.lives, last = on && this.lives === 1;
      const sc = last ? 1 + 0.15 * U.hop(beat) : 1;
      heart(g, 252 + k * 32, y + 23, 11 * sc, on ? '#ff3d6e' : 'rgba(255,255,255,.18)', on ? '#5a0a20' : 'rgba(255,255,255,.3)');
    }
    // コンボ倍率のメーター
    if (combo >= 2 && !this.over) {
      const k = Math.min(combo, 50) / 50;
      D.rrect(g, 22, y + 50, 120, 8, 4, 'rgba(0,0,0,.45)');
      D.rrect(g, 22, y + 50, Math.max(8, 120 * k), 8, 4, fever ? '#ff7ad9' : '#7affe0');
      D.text(g, `×${this.comboMult(combo).toFixed(2)}`, 148, y + 55, 11, fever ? '#ff7ad9' : '#7affe0', null, 'left', 900);
    }

    // 得点の吹き出し（ダックの上に浮かぶ）
    for (const p of this.pops) {
      const d = beat - p.beat;
      if (d < 0) continue;
      const u = Math.min(1, d / 1.6), a = 1 - U.prog(d, 1.1, 1.6);
      g.save(); g.globalAlpha = a;
      if (p.heart) { heart(g, 300, 160 - u * 30, 12, '#ff3d6e', '#5a0a20'); D.text(g, p.text, 300, 186 - u * 30, 14, '#ff7a9a', '#2b1640', 'center', 900); }
      else {
        const s = p.gold ? 1 + 0.4 * U.ease.outBack(Math.min(1, d / 0.25)) : 1;
        g.translate(290, 200 - u * 40); g.scale(s, s);
        D.text(g, p.text, 0, 0, p.gold ? 22 : 17, p.miss ? '#c0b0d0' : p.gold ? '#ffe066' : '#ffffff', '#2b1640', 'center', 900);
        if (p.sub) D.text(g, p.sub, 0, 17, 10, p.gold ? '#ffe066' : '#7affe0', '#2b1640', 'center', 900);
      }
      g.restore();
    }

    // レベルアップの帯
    const lv = this.levels.find(x => beat >= x.beat && beat - x.beat < 3.6);
    if (lv && !this.over) {
      const d = beat - lv.beat;
      const xin = d < 0.4 ? (1 - U.ease.outCubic(d / 0.4)) * 400 : d > 3.1 ? -U.ease.inCubic((d - 3.1) / 0.5) * 400 : 0;
      g.save(); g.translate(180 + xin, 186); g.rotate(-0.08);
      D.rrect(g, -200, -34, 400, 68, 0, 'rgba(255,61,110,.92)');
      D.line(g, -200, -34, 200, -34, '#ffc93a', 4); D.line(g, -200, 34, 200, 34, '#ffc93a', 4);
      D.text(g, lv.level === 1 ? 'START!' : `LEVEL ${lv.level}`, 0, -6, 34, '#ffffff', '#2b1640', 'center', 900);
      D.text(g, lv.chance ? `BPM ${lv.bpm}　★ チャンスボール ×2 ★` : `BPM ${lv.bpm}`, 0, 22, 13, '#ffe066', '#2b1640', 'center', 900);
      g.restore();
    }

    // ゲームオーバー
    if (this.over) {
      const d = beat - this.overBeat, k = U.prog(d, 0, 1.2);
      g.fillStyle = `rgba(10,4,16,${0.6 * k})`; g.fillRect(view.x0, view.y0, W, H);
      const s = U.ease.outBack(U.prog(d, 0.2, 0.8));
      g.save(); g.translate(180, 220); g.scale(s, s); g.rotate(-0.05);
      D.text(g, 'GAME OVER', 0, 0, 44, '#ff3d6e', '#ffffff', 'center', 900);
      D.text(g, `SCORE ${this.score}`, 0, 44, 22, '#ffe066', '#2b1640', 'center', 900);
      D.text(g, `レベル${this.reached} 到達`, 0, 74, 16, '#ffffff', '#2b1640', 'center', 900);
      g.restore();
    }
  }
};

function heart(g, x, y, r, fill, stroke) {
  g.save(); g.translate(x, y); g.beginPath();
  g.moveTo(0, r * 0.9);
  g.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.8, -r * 1.3, 0, -r * 0.45);
  g.bezierCurveTo(r * 0.8, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9);
  g.closePath(); g.fillStyle = fill; g.fill();
  if (stroke) { g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); }
  g.restore();
}
})();
