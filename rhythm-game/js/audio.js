/*
 * 音声エンジンと共通の時間基準
 *
 * 時間の考え方：
 *  - 音はすべて AudioContext の時計（ctx.currentTime）上の時刻を指定して予約再生する。
 *    → BGM・合図・判定・アニメーションが同じ時計を使うので、フレーム落ちしてもずれが蓄積しない。
 *  - 「聞こえている時刻（heard）」＝ スピーカーから今まさに出ている音の ctx 時刻。
 *    getOutputTimestamp() で performance.now() との対応を取り、出力遅延も含めて換算する。
 *  - 入力イベントの event.timeStamp（performance.now() と同じ基準）も同じ式で heard 時刻に変換する。
 */
RG.Audio = (function () {
  const A = {
    ctx: null,
    master: null,
    bus: {},
    buffers: new Map(),
    _off: null,          // heard時刻 − performance.now()/1000 （秒）
    _rawOff: null,
    clockSource: '-',
    listeners: []
  };

  A.init = function () {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Web Audio API に対応していないブラウザです');
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS のマナースイッチ対策（対応端末のみ） */ }
    A.ctx = new AC({ latencyHint: 'interactive' });
    A.master = A.ctx.createGain();
    // 音割れ防止のソフトクリップ（0.8 までは素通し。遅延が発生しない WaveShaper を使う）
    const shaper = A.ctx.createWaveShaper();
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * 2 - 1, ax = Math.abs(x);
      curve[i] = Math.sign(x) * (ax <= 0.8 ? ax : 0.8 + 0.2 * Math.tanh((ax - 0.8) / 0.2));
    }
    shaper.curve = curve;
    A.master.connect(shaper);
    shaper.connect(A.ctx.destination);
    ['bgm', 'cue', 'sfx'].forEach(k => { const g = A.ctx.createGain(); g.connect(A.master); A.bus[k] = g; });
    A.ctx.onstatechange = () => A.listeners.forEach(fn => fn(A.ctx.state));
    A.applyVolumes(RG.Storage.settings.vol);
    return A.ctx;
  };

  A.resume = function () {
    A.init();
    if (A.ctx.state !== 'running') return A.ctx.resume().catch(() => {});
    return Promise.resolve();
  };

  A.applyVolumes = function (vol) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const curve = v => Math.pow(v / 100, 1.6); // 聴感に近いカーブ
    A.master.gain.setTargetAtTime(curve(vol.master), t, 0.02);
    A.bus.bgm.gain.setTargetAtTime(curve(vol.bgm) * 0.8, t, 0.02);
    A.bus.cue.gain.setTargetAtTime(curve(vol.cue) * 1.1, t, 0.02);
    A.bus.sfx.gain.setTargetAtTime(curve(vol.sfx), t, 0.02);
  };

  // 音色IDから AudioBuffer を取得（なければ合成してキャッシュ）
  A.buffer = function (id) {
    let b = A.buffers.get(id);
    if (b) return b;
    const sr = A.ctx.sampleRate;
    const data = RG.Synth.render(id, sr);
    b = A.ctx.createBuffer(1, data.length, sr);
    b.getChannelData(0).set(data);
    A.buffers.set(id, b);
    return b;
  };
  A.preload = function (ids) { ids.forEach(id => A.buffer(id)); };

  // セッションごとの出力（停止時に切断すれば、予約済みの音もまとめて消える）
  A.createSessionBus = function () {
    const sb = {};
    ['bgm', 'cue', 'sfx'].forEach(k => { const g = A.ctx.createGain(); g.connect(A.bus[k]); sb[k] = g; });
    sb.sources = new Set();
    return sb;
  };
  A.destroySessionBus = function (sb) {
    if (!sb) return;
    sb.sources.forEach(s => { try { s.stop(); } catch (e) {} });
    sb.sources.clear();
    ['bgm', 'cue', 'sfx'].forEach(k => { try { sb[k].disconnect(); } catch (e) {} });
  };

  // when: ctx 時刻（秒）。dest: GainNode
  A.play = function (id, when, dest, gain = 1, sb) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = A.buffer(id);
    let node = src;
    if (gain !== 1) { const g = ctx.createGain(); g.gain.value = gain; src.connect(g); node = g; }
    node.connect(dest);
    src.start(Math.max(when, ctx.currentTime));
    if (sb) { sb.sources.add(src); src.onended = () => sb.sources.delete(src); }
    return src;
  };

  // ---- 時計 ----
  A.updateClock = function () {
    const ctx = A.ctx;
    if (!ctx) return;
    let raw;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) { raw = ts.contextTime - ts.performanceTime / 1000; A.clockSource = 'outputTimestamp'; }
    }
    if (raw === undefined) {
      raw = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - performance.now() / 1000;
      A.clockSource = 'currentTime';
    }
    A._rawOff = raw;
    // 小さな揺れはならし、大きな差（再開・機器変更）は即座に合わせる。常に音声時計を基準にするので誤差は蓄積しない
    // （通常の揺れは±3ms未満。8msを超える差は主スレッドの停止や機器の変更とみなして即座に合わせる）
    if (A._off === null || Math.abs(raw - A._off) > 0.008) A._off = raw;
    else A._off += (raw - A._off) * 0.1;
  };
  A.resetClock = function () { A._off = null; A.updateClock(); };
  A.heardNow = function () { if (A._off === null) A.updateClock(); return performance.now() / 1000 + A._off; };
  A.perfToHeard = function (ms) { if (A._off === null) A.updateClock(); return ms / 1000 + A._off; };
  // イベントの timeStamp を performance.now() 基準に正規化
  A.eventTime = function (e) {
    const now = performance.now();
    const ts = e && e.timeStamp;
    if (!ts || ts > now + 50 || ts < now - 1000) return now; // 古いブラウザ（エポック基準）や異常値
    return ts;
  };
  A.latencyInfo = function () {
    const c = A.ctx; if (!c) return '';
    return `sampleRate ${c.sampleRate}Hz / baseLatency ${Math.round((c.baseLatency || 0) * 1000)}ms / outputLatency ${Math.round((c.outputLatency || 0) * 1000)}ms / clock ${A.clockSource}`;
  };
  A.onState = fn => A.listeners.push(fn);
  return A;
})();
