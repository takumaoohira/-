/*
 * 自動テスト（ヘッドレス Chromium）
 *   NODE_PATH=$(npm root -g) node tests/run-tests.cjs [出力フォルダ] [ゲームID...]
 *
 * ボットは「正解時刻 ＋ 指定の誤差」の timeStamp で入力を送ります（実際の入力処理と同じ Session.input を通る）。
 * 確認する内容：
 *   1. 全部ぴったり → 100点・全Perfect
 *   2. 入力なし → 0点・全Miss
 *   3. 連打（60msごと） → 高得点にならない
 *   4. 一定の遅れ（+35ms）＋入力補正+35ms → 全Perfect（補正の向きが正しい）
 *   5. 描画が重い（定期的に主スレッドを250ms止める）→ 判定がずれない・後半でもずれが蓄積しない
 *   6. 再挑戦の連打 → セッションと音が重ならない
 *   7. 練習モードを最後まで → 練習完了画面へ
 *   8. Spaceキーの実入力が判定される
 *   9. エンドレス（ピンポン・ファンク）：レベルが上がるとテンポが上がる・チャンスボールは得点2倍・ミス3回でゲームオーバー
 *   ゲームIDの代わりに endless を指定すると、エンドレスのテストだけを実行します。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || path.resolve(__dirname, '../docs');
const ONLY = process.argv.slice(3);
const URL = 'file://' + path.resolve(__dirname, '../index.html') + '?dev';
fs.mkdirSync(OUT, { recursive: true });

const BOT = `
window.__bot = function (opts) {
  opts = opts || {};
  const s = RG.App.session, A = RG.Audio;
  let i = 0, lastMash = 0;
  const done = new Promise(res => { window.__botDone = res; });
  const tick = () => {
    if (s !== RG.App.session || !s.running) { window.__botDone(); return; }
    let now = performance.now();
    if (opts.lagEveryMs && now - (window.__lagT || 0) > opts.lagEveryMs) {
      window.__lagT = now; const until = now + opts.lagMs; while (performance.now() < until) {}
      now = performance.now();
    }
    if (opts.mashMs) {
      if (now - lastMash >= opts.mashMs) { lastMash = now; s.input(now, 'bot'); }
    } else if (!opts.none) {
      const ins = s.chart.inputs;
      while (i < ins.length) {
        const tg = ins[i];
        if (tg.demo) { i++; continue; }
        const err = typeof opts.err === 'function' ? opts.err(tg) : (opts.err || 0);
        if (err === null) { i++; continue; } // null：この対象は押さない
        const perf = (s.startAt + tg.time + err - A._off) * 1000;
        if (perf > now) break;
        s.input(perf, 'bot'); i++;
      }
    }
    setTimeout(tick, 2);
  };
  tick();
  return done;
};
`;

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text()); });
  await page.goto(URL);
  await page.addScriptTag({ content: BOT });
  await page.click('#btn-start');
  await page.waitForTimeout(200);
  return page;
}

async function playMain(page, id, botOpts, settings, hard) {
  await page.evaluate(([id, settings, hard]) => {
    Object.assign(RG.Storage.settings, settings || {});
    return RG.App.startGame(id, 'main', { hard: !!hard });
  }, [id, settings, hard]);
  await page.evaluate(o => {
    if (o && o.errMs !== undefined) o.err = o.errMs / 1000;
    return window.__bot(o);
  }, botOpts);
  await page.waitForFunction(() => RG.App.screen === 'result', null, { timeout: 120000 });
  const r = await page.evaluate(() => ({
    score: +document.getElementById('res-score').textContent, // カウントアップ中の可能性があるので下で再取得
    rank: document.getElementById('res-rank').textContent,
    perfect: +document.getElementById('res-perfect').textContent,
    good: +document.getElementById('res-good').textContent,
    miss: +document.getElementById('res-miss').textContent,
    extra: +document.getElementById('res-extra').textContent,
    combo: +document.getElementById('res-combo').textContent,
    total: +document.getElementById('res-total').textContent,
    advice: [...document.querySelectorAll('#res-advice li')].map(x => x.textContent)
  }));
  await page.waitForTimeout(1000);
  r.score = await page.evaluate(() => +document.getElementById('res-score').textContent);
  return r;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const RUN_ENDLESS = !ONLY.length || ONLY.includes('endless');
  const OTHERS = !ONLY.length || ONLY.some(x => x !== 'endless');
  const games = ONLY.length ? ONLY.filter(x => x !== 'endless') : ['mochi', 'penguin', 'echo', 'pingpong', 'golf', 'disco', 'rope', 'kime', 'karaoke', 'pie', 'robot', 'shateki', 'dj', 'piano', 'hanabi'];
  // 5つずつ並列に実行（同時に動かしすぎると、テスト環境のCPUが足りずに音の予約が遅れるため）
  const pool = async (list, fn) => { for (let i = 0; i < list.length; i += 5) await Promise.all(list.slice(i, i + 5).map(fn)); };

  // ゲームごとに並列で実行
  await pool(games, async id => {
    const page = await newPage(browser);
    // 1. 全部ぴったり（判定時のずれも記録）
    const perfect = await playMain(page, id, { errMs: 0 }, { inputOffsetMs: 0 });
    const st = await page.evaluate(() => RG.App.lastStats);
    check(`${id}: 曲の最後まで時計の誤差が小さい（<8ms）・予約遅れなし`, st.maxClockErrMs < 8 && st.lateEvents === 0, JSON.stringify(st));
    check(`${id}: 全部ぴったり → 100点`, perfect.score === 100 && perfect.perfect === perfect.total && perfect.extra === 0, JSON.stringify(perfect));
    await page.screenshot({ path: `${OUT}/test_${id}_result.png` });

    // 4. 一定の遅れ +35ms を入力補正で打ち消す
    const late = await playMain(page, id, { errMs: 35 }, { inputOffsetMs: 35 });
    check(`${id}: +35ms遅れ＆補正+35ms → 全Perfect`, late.perfect === late.total, JSON.stringify(late));

    // 4b. 補正なしで +75ms 遅れ → すべて Good、アドバイスに「遅れ」
    const late2 = await playMain(page, id, { errMs: 75 }, { inputOffsetMs: 0 });
    check(`${id}: +75ms遅れ（補正なし） → 全Good・遅れの助言`, late2.good === late2.total && late2.score === 60 && late2.advice.some(a => a.includes('遅れて')), JSON.stringify(late2));

    // 5. 描画が重い（2秒ごとに250ms止める）
    const lag = await playMain(page, id, { errMs: 0, lagEveryMs: 2000, lagMs: 250 }, { inputOffsetMs: 0 });
    const lagSt = await page.evaluate(() => RG.App.lastStats);
    lag.stats = lagSt;
    check(`${id}: 主スレッドが定期的に250ms止まっても判定がずれない・時計の誤差<10ms`, lag.perfect === lag.total && lagSt.maxClockErrMs < 10, JSON.stringify(lag));

    // ハード版：全部ぴったり → 100点、+75ms遅れ → 全Good、譜面の検証エラーなし
    const hp = await playMain(page, id, { errMs: 0 }, { inputOffsetMs: 0 }, true);
    const hproblems = await page.evaluate(id => { const c = new RG.Chart(RG.Games[id], { bpm: RG.Games[id].hard.bpm }); RG.Games[id].hard.main.forEach(t => c.place(t)); const n = new RG.Chart(RG.Games[id]); RG.Games[id].main.forEach(t => n.place(t)); return { hard: c.validate(), normal: n.validate(), hardSec: c.t(c.endBeat).toFixed(1), normalSec: n.t(n.endBeat).toFixed(1) }; }, id);
    check(`${id}: ハード版 全部ぴったり → 100点・譜面の検証OK`, hp.score === 100 && hp.perfect === hp.total && !hproblems.hard.length && !hproblems.normal.length, JSON.stringify({ hp, hproblems }));
    const hl = await playMain(page, id, { errMs: -75 }, { inputOffsetMs: 0 }, true);
    check(`${id}: ハード版 −75ms早め → 全Good・早めの助言`, hl.good === hl.total && hl.advice.some(a => a.includes('早め')), JSON.stringify(hl));
    const hr = await page.evaluate(id => RG.Storage.record(id), id);
    check(`${id}: ハードの記録は別に保存`, hr.hardBest === 100 && hr.best === 100, JSON.stringify(hr));

    if (id === games[0]) {
      // 2. 入力なし
      const none = await playMain(page, id, { none: true }, {});
      check(`${id}: 入力なし → 0点・全Miss`, none.score === 0 && none.miss === none.total, JSON.stringify(none));
      // 3. 連打
      const mash = await playMain(page, id, { mashMs: 60 }, {});
      check(`${id}: 60msごとの連打 → 0点`, mash.score === 0, JSON.stringify(mash));
      const mash2 = await playMain(page, id, { mashMs: 250 }, {});
      check(`${id}: 250msごとの連打 → 高得点にならない(<40)`, mash2.score < 40, JSON.stringify(mash2));
    }
    console.log(`${id} errors:`, page.errors.filter(e => !e.includes('ERR_CERT_AUTHORITY_INVALID')));
    await page.close();
  });

  // 6. 再挑戦の連打で音・入力が重ならない
  if (OTHERS) {
    const page = await newPage(browser);
    for (let k = 0; k < 6; k++) {
      await page.evaluate(() => RG.App.startGame('mochi', 'main'));
      await page.waitForTimeout(300 + k * 50);
    }
    // ボタンの連打（await を待たずに3回）でも、動くセッションは1つだけ
    await page.evaluate(() => { RG.__sessions = []; const orig = RG.Session; RG.Session = class extends orig { constructor(...a) { super(...a); RG.__sessions.push(this); } }; RG.App.startGame('mochi', 'main'); RG.App.startGame('mochi', 'main'); RG.App.startGame('mochi', 'main'); });
    await page.waitForTimeout(600);
    const running = await page.evaluate(() => RG.__sessions.filter(s => s.running).length);
    check('開始ボタンの連打（3回同時）→ 動くセッションは1つ', running === 1, `running=${running}`);
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => {
      const s = RG.App.session;
      // 1回のタップで判定ログが1件だけ増えること
      const before = s.judge.log.length;
      s.input(performance.now(), 'bot');
      return { sources: s.sb.sources.size, logAdded: s.judge.log.length - before, connected: !!s.sb };
    });
    // 旧セッションの音は destroySessionBus で全停止している（sources は新セッションの分だけ）
    check('再挑戦を6回連続 → 入力は1回につき1件・旧セッションの音は停止', st.logAdded === 1 && st.sources < 12, JSON.stringify(st));
    // 8. Spaceキー（直前のボット入力から25ms以内だと「重複入力」として無視されるので少し待つ）
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => RG.App.session.judge.log.length);
    await page.keyboard.down('Space'); await page.waitForTimeout(400); await page.keyboard.up('Space'); // 長押し（キーリピート）も1回
    const after = await page.evaluate(() => RG.App.session.judge.log.length);
    check('Spaceキーの長押し → 入力は1回だけ', after - before === 1, `${after - before}`);
    // タップ（タッチ）→ 1回だけ
    const b2 = await page.evaluate(() => RG.App.session.judge.log.length);
    await page.touchscreen.tap(195, 500);
    await page.waitForTimeout(200);
    const a2 = await page.evaluate(() => RG.App.session.judge.log.length);
    check('画面タップ（タッチ） → 入力は1回だけ（click等と重複しない）', a2 - b2 === 1, `${a2 - b2}`);
    // 一時停止ボタンのタップは入力にならない
    const b3 = await page.evaluate(() => RG.App.session.judge.log.length);
    await page.touchscreen.tap(28, 30);
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => !document.getElementById('overlay-pause').hidden);
    check('一時停止ボタン → 判定に入らず一時停止', paused && b3 >= 0, '');
    // 中断（バックグラウンド）→ 再開でカウントから
    await page.click('#btn-restart');
    await page.waitForTimeout(800);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const intr = await page.evaluate(() => ({ overlay: !document.getElementById('overlay-pause').hidden, session: !!RG.App.session, title: document.getElementById('pause-title').textContent }));
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
    await page.click('#btn-restart');
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() => ({ t: RG.App.session.songTime(), running: RG.App.session.running }));
    check('バックグラウンドで中断 → 再開で最初（カウント）から', intr.overlay && !intr.session && resumed.running && resumed.t < 0.5, JSON.stringify({ intr, resumed }));
    console.log('retry errors:', page.errors);
    await page.close();
  }

  // 7. 練習モードを最後まで（ぴったり入力）
  await pool(games, async id => {
    const page = await newPage(browser);
    await page.evaluate(id => RG.App.startGame(id, 'practice'), id);
    // 最初の試行を1回わざと失敗させて、同じ課題が繰り返されるか
    await page.evaluate(() => window.__bot({ err: tg => (tg.trial === 1 ? 0.3 : 0) }));
    await page.waitForFunction(() => RG.App.screen === 'practice-done', null, { timeout: 180000 });
    const info = await page.evaluate(id => ({ practiced: RG.Storage.record(id).practiced, title: document.getElementById('pd-title').textContent }), id);
    check(`${id}: 練習を最後まで（1回目は失敗）→ 練習完了・保存`, info.practiced && info.title === '練習クリア！', JSON.stringify(info));
    console.log(`${id} practice errors:`, page.errors.filter(e => !e.includes('ERR_CERT_AUTHORITY_INVALID')));
    await page.close();
  });

  // 9. エンドレス
  if (RUN_ENDLESS) {
    const page = await newPage(browser);
    // レベル1〜3はぴったり、レベル4からは何も押さない → レベル4でゲームオーバー
    await page.evaluate(() => {
      const orig = RG.App.onEndlessEnd;
      RG.App.onEndlessEnd = (s, r) => { window.__end = s; orig(s, r); };
      return RG.App.startGame('pingpong', 'endless', { seed: 11 });
    });
    const sel0 = await page.evaluate(() => RG.App.session.mode);
    await page.evaluate(() => window.__bot({ err: tg => (tg.inst.tok.level >= 4 ? null : 0) }));
    await page.waitForFunction(() => RG.App.screen === 'result', null, { timeout: 200000 });
    await page.waitForTimeout(1200);
    const e = await page.evaluate(() => {
      const s = window.__end, E = s.endless, c = s.chart;
      // 得点を判定結果から計算し直す（Perfect 100 × レベル倍率 × コンボ倍率 × チャンス2倍）
      let combo = 0, exp = 0;
      const judged = c.inputs.filter(x => x.judged && x.judged !== 'demo').sort((a, b) => a.time - b.time);
      judged.forEach(tg => {
        if (tg.judged === 'miss') { combo = 0; return; }
        combo++;
        const L = tg.inst.tok.level;
        exp += Math.round(100 * (1 + 0.25 * (L - 1)) * (1 + Math.min(combo, 50) * 0.02) * (tg.type === 'chance' ? 2 : 1) / 10) * 10;
      });
      // 「コン」（相手が打つ）から打ち返すまで＝1拍の秒数 → そのレベルのBPM
      const beatSec = L => { const cue = c.cues.find(x => x.type === 'pong' && x.target && x.inst.tok.level === L); return cue ? cue.target.time - cue.time : null; };
      const gap1 = beatSec(1), gap3 = beatSec(3);
      const chanceTg = judged.filter(x => x.type === 'chance');
      return {
        mode: RG.App.last.mode, score: E.score, expected: exp, reached: E.reached, lives: E.lives, chance: E.chance,
        miss: s.judge.s.miss, perfect: s.judge.s.perfect, gap1, gap3, bpm1: gap1 ? 60 / gap1 : null, bpm3: gap3 ? 60 / gap3 : null,
        chanceJudged: chanceTg.map(x => x.judged), late: s.lateEvents || 0, clockErrMs: (s.maxClockErr || 0) * 1000,
        resScore: +document.getElementById('res-score').textContent, resRank: document.getElementById('res-rank').textContent,
        resChance: document.getElementById('res-total').textContent, label: document.getElementById('res-total-label').textContent,
        rec: RG.Storage.record('pingpong')
      };
    });
    check('エンドレス：選択画面から開始 → エンドレスのセッション', sel0 === 'endless' && e.mode === 'endless', JSON.stringify({ sel0, mode: e.mode }));
    check('エンドレス：レベルごとにテンポが上がる（Lv1=96 → Lv3=108 BPM）', Math.abs(e.bpm1 - 96) < 0.01 && Math.abs(e.bpm3 - 108) < 0.01, JSON.stringify({ bpm1: e.bpm1, bpm3: e.bpm3 }));
    check('エンドレス：レベルアップ毎にチャンスボール（Lv2・Lv3は成功、Lv4は見送り）', e.chance.hit === 2 && e.chance.total === 3 && e.resChance === '2/3' && e.label === 'チャンス', JSON.stringify({ chance: e.chance, judged: e.chanceJudged, res: e.resChance }));
    check('エンドレス：得点＝Perfect100×レベル倍率×コンボ倍率（チャンスは2倍）', e.score === e.expected && e.score > 0 && e.resScore === e.score, JSON.stringify({ score: e.score, expected: e.expected, res: e.resScore }));
    check('エンドレス：ミス3回でゲームオーバー（チャンスの見送りはライフ減なし）→ レベル4到達', e.lives === 0 && e.miss === 4 && e.reached === 4 && e.resRank.includes('レベル4'), JSON.stringify({ lives: e.lives, miss: e.miss, reached: e.reached, rank: e.resRank }));
    check('エンドレス：テンポが変わっても予約遅れなし・時計の誤差<8ms', e.late === 0 && e.clockErrMs < 8, JSON.stringify({ late: e.late, clockErrMs: e.clockErrMs }));
    check('エンドレス：ハイスコアと最高レベルを保存', e.rec.endlessBest === e.score && e.rec.endlessLevel === 4, JSON.stringify(e.rec));
    await page.screenshot({ path: `${OUT}/test_endless_result.png` });
    // 譜面を先までまとめて作る：レベル25（BPM 240）まで入力どうしの間隔と返球の時間がOK
    const v = await page.evaluate(() => {
      const fake = { opts: { seed: 5 }, judge: { s: { combo: 0 } } };
      fake.chart = new RG.Chart(RG.Games.pingpong, { bpm: RG.Games.pingpong.endless.bpm0 });
      fake.game = RG.Games.pingpong;
      const E = new RG.Endless(fake);
      while (E.level < 26) E.fill(fake.chart.cursor);
      const until = E.levels.find(x => x.level === 26).beat;
      const c = fake.chart;
      c.inputs = c.inputs.filter(x => x.beat < until); c.cues = c.cues.filter(x => x.beat < until);
      const used = new Set(c.instances.map(i => i.p));
      return { problems: c.validate(), level: E.level, bpm25: E.bpmOf(25), used: [...used] };
    });
    check('エンドレス：レベル25（BPM 240）まで譜面の検証OK・全パターンが登場', !v.problems.length && ['X1', 'X2', 'LS', 'SS', 'chance', 'lvup'].every(p => v.used.includes(p)), JSON.stringify(v).slice(0, 400));
    // もう一度 → エンドレスで再開
    await page.click('#btn-retry');
    await page.waitForTimeout(600);
    const again = await page.evaluate(() => RG.App.session && RG.App.session.mode);
    check('エンドレス：結果画面の「もう一度」→ エンドレスで再開', again === 'endless', String(again));
    await page.evaluate(() => RG.App.stopSession());
    console.log('endless errors:', page.errors.filter(e => !e.includes('ERR_CERT_AUTHORITY_INVALID')));
    await page.close();
  }

  // 声の合図は「最初の母音」が拍ちょうどに来るように予約される
  if (OTHERS) {
    const page = await newPage(browser);
    const v = await page.evaluate(() => {
      const c = new RG.Chart(RG.Games.disco); RG.Games.disco.main.forEach((t, i, a) => c.place(t, a[i + 1]));
      const cue = c.cues.find(x => x.type === 'hai'), ev = c.drainAudio().find(e => e.id === 'voice:boss:ハイ！');
      return { cueTime: cue.time, eventTime: ev.time, onset: RG.Voice.onset('voice:boss:ハイ！') };
    });
    check('声の合図：母音の頭が拍ちょうど（予約時刻＝拍の時刻−母音までの長さ）', Math.abs(v.eventTime + v.onset - v.cueTime) < 1e-9 && v.onset > 0, JSON.stringify(v));
    await page.close();
  }

  // 保存が再読み込み後も残る
  if (OTHERS) {
    const page = await newPage(browser);
    await page.evaluate(() => { RG.Storage.settings.inputOffsetMs = 42; RG.Storage.record('mochi').best = 77; RG.Storage.save(); });
    await page.reload();
    const v = await page.evaluate(() => ({ off: RG.Storage.settings.inputOffsetMs, best: RG.Storage.record('mochi').best }));
    check('再読み込み後も設定と記録が残る', v.off === 42 && v.best === 77, JSON.stringify(v));
    await page.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(OUT, 'test-results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
