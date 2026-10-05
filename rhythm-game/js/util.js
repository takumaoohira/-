RG.U = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
  };
  // 0..1 の区間 [a,b] での進み具合
  const prog = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
  // 拍に合わせた弾み（拍頭で0、拍の途中で最大）
  const hop = beat => Math.sin(Math.PI * (((beat % 1) + 1) % 1));
  // 減衰（イベントからの経過拍 d に対して1→0）
  const decay = (d, len) => (d < 0 || d > len ? 0 : 1 - d / len);

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    if (typeof name === 'number') return name;
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error('bad note ' + name);
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return n + (parseInt(m[3], 10) + 1) * 12;
  }
  const freq = m => 440 * Math.pow(2, (midi(m) - 69) / 12);

  function median(a) {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  function stdev(a) {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  }
  return { clamp, lerp, ease, prog, hop, decay, midi, freq, median, mean, stdev };
})();
