/*
 * 画面確認用のスクリーンショット（ヘッドレス Chromium）
 *   NODE_PATH=$(npm root -g) node tests/screens.cjs [出力フォルダ]
 * 指定した拍の場面を、判定結果を与えた状態で描画して保存します。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../docs');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
fs.mkdirSync(OUT, { recursive: true });

// [ゲーム, ファイル名, 何番目の判定対象か, 判定, 判定から何拍後を描くか, 練習か]
const SHOTS = [
  ['mochi', 'cue', 0, null, -0.9],
  ['mochi', 'perfect', 1, 'perfect', 0.3],
  ['mochi', 'double_cue', 6, null, -0.6],
  ['mochi', 'perfect_moon', 7, 'perfect', 0.35],
  ['mochi', 'miss', 2, 'miss', 0.5],
  ['mochi', 'finale', -1, 'fin', 1.0],
  ['penguin', 'normal_flight', 0, null, -1.0],
  ['penguin', 'express_flight', 6, null, -0.5],
  ['penguin', 'catch', 3, 'perfect', 0.25],
  ['penguin', 'miss', 4, 'miss', 0.6],
  ['penguin', 'finale', -1, 'fin', 1.5],
  ['echo', 'listen', 0, null, -2.6],
  ['echo', 'respond', 1, 'perfect', 0.2],
  ['echo', 'miss', 3, 'miss', 0.4],
  ['echo', 'offbeat', 30, 'good', 0.1],
  ['echo', 'finale', -1, 'fin', 1.2],
  ['pingpong', 'normal', 0, null, -0.3],
  ['pingpong', 'hit', 1, 'perfect', 0.4],
  ['pingpong', 'smash', 12, null, -0.15],
  ['pingpong', 'lob', 18, null, -1.4],
  ['pingpong', 'miss', 3, 'miss', 0.4],
  ['pingpong', 'finale', -1, 'fin', 1.0],
  ['golf', 'drive', 0, null, -0.4],
  ['golf', 'perfect', 1, 'perfect', 0.7],
  ['golf', 'chip', 6, null, -0.6],
  ['golf', 'rush', 12, null, -0.5],
  ['golf', 'miss', 2, 'miss', 1.0],
  ['golf', 'finale', -1, 'fin', 1.4],
  ['disco', 'hai_call', 'cue:hai', null, 0.3],
  ['disco', 'clap', 9, 'perfect', 0.1],
  ['disco', 'freeze', 'cue:freeze', null, 0.8],
  ['disco', 'turn', 'cue:turn', null, 1.2],
  ['rope', 'jump', 0, 'perfect', 0.15],
  ['rope', 'double', 'cue:double', null, 1.1],
  ['rope', 'miss', 2, 'miss', 0.4],
  ['kime', 'pickup', 'cue:roll', null, 0.6],
  ['kime', 'kime_hit', 1, 'perfect', 0.15],
  ['kime', 'miss', 2, 'miss', 0.5],
  ['karaoke', 'singing', 'cue:sing', null, 1.2],
  ['karaoke', 'aite', 0, 'perfect', 0.1],
  ['karaoke', 'miss', 2, 'miss', 0.5],
  ['pie', 'throw', 0, null, -0.8],
  ['pie', 'dodge', 1, 'perfect', 0.1],
  ['pie', 'creamed', 2, 'miss', 0.4],
  ['pie', 'triple', 'cue:triple', null, 2.3],
  ['karaoke', 'finale', -1, 'fin', 1.2],
  ['robot', 'call', 'cue:head', null, 0.5],
  ['robot', 'slam', 0, 'perfect', 0.05],
  ['robot', 'built', 3, 'perfect', 1.2],
  ['robot', 'error', 2, 'miss', 0.3],
  ['robot', 'finale', -1, 'fin', 1.0],
  ['shateki', 'duck', 0, null, -0.6],
  ['shateki', 'hit', 1, 'perfect', 0.15],
  ['shateki', 'balloons', 'cue:balloon', null, 1.6],
  ['shateki', 'oji', 'cue:oji', null, 0.8],
  ['shateki', 'finale', -1, 'fin', 1.0],
  ['dj', 'build', 'cue:build', null, 3.2],
  ['dj', 'drop', 0, 'perfect', 0.3],
  ['dj', 'stab', 2, 'perfect', 0.1],
  ['piano', 'run', 'cue:note', null, 2.2],
  ['piano', 'resolve', 1, 'perfect', 0.2],
  ['piano', 'eighth', 'cue:note', null, 0.1],
  ['hanabi', 'rising', 0, null, -0.6],
  ['hanabi', 'burst', 1, 'perfect', 0.35],
  ['hanabi', 'triple', 'cue:launch', null, 0.4],
  ['hanabi', 'finale', -1, 'fin', 0.7]
];

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const sizes = [{ name: 'phone', w: 390, h: 844, dpr: 2 }];
  for (const sz of sizes) {
    const page = await browser.newPage({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: sz.dpr });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL);
    await page.click('#btn-start');
    for (const [id, name, idx, kind, after] of SHOTS) {
      await page.evaluate(async ([id, idx, kind, after]) => {
        await RG.App.startGame(id, 'main');
        const s = RG.App.session;
        s.stop();
        const real = s.chart.inputs.filter(x => !x.demo);
        let beat;
        if (kind === 'fin') {
          beat = s.chart.fx.find(f => f.type === 'finale').beat + after;
          real.forEach(tg => { tg.judged = 'perfect'; s.scene.onJudge(tg, 'perfect', tg.beat, { kind: 'perfect' }); });
        } else if (typeof idx === 'string') { // 'cue:種類' → その合図の最初の1つから after 拍後
          const c = s.chart.cues.find(c => c.type === idx.slice(4));
          real.filter(x => x.beat < c.beat).forEach(x => { x.judged = 'perfect'; s.scene.onJudge(x, 'perfect', x.beat, { kind: 'perfect' }); });
          beat = c.beat + after;
        } else {
          const tg = real[idx];
          // それまでの対象はすべて成功扱い
          real.slice(0, idx).forEach(x => { x.judged = 'perfect'; s.scene.onJudge(x, 'perfect', x.beat, { kind: 'perfect' }); });
          if (kind) {
            if (kind !== 'miss') s.scene.onTap(tg.beat);
            tg.judged = kind;
            s.scene.onJudge(tg, kind, tg.beat + (kind === 'miss' ? 0.3 : 0), { kind });
          }
          beat = tg.beat + after;
        }
        const g = s.chart.guideAt(beat);
        RG.App.guide(g ? g.text : '');
        RG.App.subInfo(kind === 'perfect' ? '5 コンボ' : '');
        RG.App.render(s, beat);
      }, [id, idx, kind, after]);
      await page.screenshot({ path: `${OUT}/screen_${id}_${name}.png` });
    }
    // エンドレス（ピンポン・ファンク）
    const EN = [
      ['levelup', { level: 2, at: 'lv', after: 0.9, score: 4210, combo: 22 }],
      ['chance', { level: 3, at: 'chance', after: -0.8, score: 11380, combo: 31 }],
      ['fever', { level: 5, at: 'rally', after: 1.3, score: 38650, combo: 44 }],
      ['lastlife', { level: 7, at: 'rally', after: 2.2, score: 76120, combo: 3, lives: 1 }],
      ['gameover', { level: 8, at: 'rally', after: 1.6, score: 98770, combo: 0, lives: 0, over: true }]
    ];
    for (const [name, o] of EN) {
      await page.evaluate(async o => {
        await RG.App.startGame('pingpong', 'endless', { seed: 21 });
        const s = RG.App.session; s.stop();
        const E = s.endless;
        while (E.level < o.level + 1) E.fill(s.chart.cursor);
        const lv = E.levels.find(x => x.level === o.level);
        let beat;
        if (o.at === 'lv') beat = lv.beat + o.after;
        else if (o.at === 'chance') beat = s.chart.inputs.find(x => x.type === 'chance' && x.beat > lv.beat).beat + o.after;
        else beat = s.chart.inputs.find(x => x.beat > lv.beat + 12).beat + o.after;
        // それまでの対象はすべて成功扱い
        s.chart.inputs.filter(x => x.beat < beat - 0.6).forEach(x => { x.judged = 'perfect'; s.scene.onJudge(x, 'perfect', x.beat, { kind: 'perfect' }); });
        E.levels.forEach(x => { if (x.beat <= beat) x.applied = true; });
        E.score = E.shown = o.score; s.judge.s.combo = o.combo;
        if (o.lives !== undefined) E.lives = o.lives;
        E.pops.push({ beat: beat - 0.3, text: '+' + Math.round(100 * E.levelMult(o.level) * E.comboMult(o.combo) / 10) * 10, sub: 'PERFECT' });
        if (o.at === 'chance') E.pops.length = 0;
        if (o.over) { E.over = true; E.overBeat = beat - o.after; }
        const g = s.chart.guideAt(beat);
        RG.App.guide(g ? g.text : '');
        RG.App.subInfo(E.infoText());
        RG.App.render(s, beat);
      }, o);
      await page.screenshot({ path: `${OUT}/screen_endless_${name}.png` });
    }
    await page.evaluate(() => {
      RG.App.showResult(RG.Games.pingpong, { endless: true, score: 98770, level: 8, bpm: 138, chance: { hit: 6, total: 7 }, perfect: 402, good: 31, miss: 4, extra: 2, maxCombo: 187, total: 437, advice: ['チャンスボール 6/7 成功', 'タイミングがとても安定しています！'] }, true, 76120);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/ui_result_endless.png` });

    // 画面サイズ違い
    for (const v of [{ w: 360, h: 640, n: 'small' }, { w: 1280, h: 720, n: 'pc' }, { w: 844, h: 390, n: 'landscape' }]) {
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.evaluate(async () => {
        await RG.App.startGame('penguin', 'main');
        const s = RG.App.session; s.stop();
        RG.App.resizeCanvas();
        RG.App.render(s, s.chart.inputs[0].beat - 0.5);
      });
      await page.screenshot({ path: `${OUT}/size_${v.n}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const scr of ['title', 'select', 'settings']) {
      await page.evaluate(scr => RG.App.show(scr), scr);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/ui_${scr}.png` });
    }
    // 結果画面
    await page.evaluate(() => {
      RG.App.showResult(RG.Games.mochi, { score: 87, rank: RG.CONFIG.ranks[1], perfect: 21, good: 6, miss: 3, extra: 1, maxCombo: 14, total: 30, advice: ['少し早めに押す傾向があります（平均 24ms 早い）'] }, true, 72);
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/ui_result.png` });
    // 練習の画面
    await page.evaluate(async () => { await RG.App.startGame('echo', 'practice'); });
    await page.waitForTimeout(5200);
    await page.screenshot({ path: `${OUT}/ui_practice.png` });
    await page.evaluate(() => RG.App.stopSession());
    console.log('errors:', errs);
    await page.close();
  }
  await browser.close();
})();
