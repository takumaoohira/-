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
  ['echo', 'finale', -1, 'fin', 1.2]
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
