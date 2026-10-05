/*
 * 調整用の設定値（試遊しながら変更する値はここにまとめています）
 * 判定幅（Perfect/Good）と余分な入力の減点は、設定画面の「開発者向け」からも変更でき、端末に保存されます。
 */
window.RG = window.RG || {};

RG.CONFIG = {
  judge: {
    perfectMs: 50,      // Perfect：正解時刻との差が ±50ms 以内
    goodMs: 100,        // Good：±50ms を超え ±100ms 以内
    captureMs: 150,     // この範囲の入力は「その対象への Miss（早すぎ／遅すぎ）」として扱う。範囲外は余分な入力
    expireGraceMs: 80,  // 押し忘れを Miss にするまでの猶予（描画遅延で入力処理が後回しになっても取りこぼさないため）
    doubleInputGuardMs: 25 // これより短い間隔の入力は同じ入力の重複とみなして無視
  },
  score: {
    goodWeight: 0.6,    // 100 ×（Perfect数 ＋ Good数 × 0.6）÷ 全判定対象数
    extraPenalty: 1     // 余分な入力1回あたりの減点
  },
  // 評価区分（上から順に判定）
  ranks: [
    { min: 90, label: '大成功！', key: 'superb' },
    { min: 75, label: 'いい感じ！', key: 'great' },
    { min: 60, label: 'クリア！', key: 'ok' },
    { min: -1, label: 'もう一度！', key: 'try' }
  ],
  clearScore: 60,
  advice: {
    minSamples: 8,      // 傾向を出すのに必要な入力数
    biasMs: 18,         // 平均のずれがこれを超えたら「早め／遅め」と表示
    calibSuggestMs: 45, // これを超えたらタイミング調整を勧める
    steadyMs: 30        // ばらつき（標準偏差）がこれ未満なら「安定」
  },
  practice: {
    needStreak: 2,      // 連続成功でクリア
    demoReps: 2,        // お手本の回数
    reDemoAfterFails: 4 // 連続でこの回数失敗したら、お手本をもう一度見せる
  },
  audio: {
    lookahead: 0.4,     // 先読みして予約する秒数（主スレッドが少し止まっても音が途切れないよう長めに）
    intervalMs: 25,     // 予約処理の間隔
    startLead: 0.35     // 再生開始までの余裕
  }
};
