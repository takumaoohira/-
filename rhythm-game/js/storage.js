/* 端末内保存（localStorage）。使えない環境でもゲームは動くようにする */
RG.Storage = (function () {
  const KEY = 'rhythm-biyori-save-v1';
  const GAMES = ['mochi', 'penguin', 'echo', 'pingpong', 'golf'];

  function defaults() {
    const records = {};
    GAMES.forEach(id => { records[id] = { best: null, cleared: false, plays: 0, practiced: false, hardBest: null, hardCleared: false }; });
    return {
      version: 1,
      settings: {
        vol: { master: 85, bgm: 70, cue: 95, sfx: 80 },
        inputOffsetMs: 0,   // ＋なら「遅れて押す」分を差し引いて判定
        visualOffsetMs: 0,  // ＋なら映像を遅らせる（判定には影響しない）
        vibration: true,
        shake: true,
        debug: false,
        judge: { perfectMs: RG.CONFIG.judge.perfectMs, goodMs: RG.CONFIG.judge.goodMs, extraPenalty: RG.CONFIG.score.extraPenalty },
        calibratedAt: null
      },
      records
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (!(k in saved)) continue;
      const b = base[k], s = saved[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object') base[k] = merge(b, s);
      else if (s !== undefined && (b === null || typeof s === typeof b)) base[k] = s;
    }
    return base;
  }

  let data = defaults();
  let available = true;

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      data = merge(defaults(), raw ? JSON.parse(raw) : null);
    } catch (e) {
      available = false;
      data = defaults();
    }
    return data;
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); available = true; }
    catch (e) { available = false; }
  }
  function resetRecords() { data.records = defaults().records; save(); }

  return {
    load, save, resetRecords,
    get data() { return data; },
    get settings() { return data.settings; },
    get available() { return available; },
    record(id) { return data.records[id]; },
    defaults
  };
})();
