/* キャンバス描画の共通部品（キャラクターはすべてコードで描いています） */
RG.D = (function () {
  const TAU = Math.PI * 2;
  function ell(g, x, y, rx, ry, fill, stroke, lw) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw || 3; g.strokeStyle = stroke; g.stroke(); }
  }
  function circ(g, x, y, r, fill, stroke, lw) { ell(g, x, y, r, r, fill, stroke, lw); }
  function rrect(g, x, y, w, h, r, fill, stroke, lw) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw || 3; g.strokeStyle = stroke; g.stroke(); }
  }
  function star(g, x, y, r1, r2, n, rot, fill, stroke, lw) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw || 3; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke(); }
  }
  // 三日月
  function crescent(g, x, y, r, fill) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.arc(x + r * 0.45, y - r * 0.2, r * 0.82, 0, TAU, true);
    g.fillStyle = fill; g.fill('evenodd'); g.restore();
  }
  function line(g, x1, y1, x2, y2, color, lw, cap = 'round') {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = cap; g.stroke();
  }
  // 目。mood: 'normal' | 'happy'(^^) | 'closed' | 'x' | 'smug' | 'wide' | 'dizzy'
  function eyes(g, x, y, gap, r, mood, look = 0) {
    for (const s of [-1, 1]) {
      const ex = x + s * gap;
      g.lineWidth = Math.max(2, r * 0.55); g.strokeStyle = '#2a1f2e'; g.lineCap = 'round';
      if (mood === 'happy') { g.beginPath(); g.arc(ex, y + r * 0.4, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      else if (mood === 'closed') { line(g, ex - r, y, ex + r, y, '#2a1f2e', Math.max(2, r * 0.5)); }
      else if (mood === 'x') { line(g, ex - r * .7, y - r * .7, ex + r * .7, y + r * .7, '#2a1f2e', 2.5); line(g, ex + r * .7, y - r * .7, ex - r * .7, y + r * .7, '#2a1f2e', 2.5); }
      else if (mood === 'smug') { g.beginPath(); g.arc(ex, y - r * 0.2, r, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
      else if (mood === 'dizzy') { g.beginPath(); g.arc(ex, y, r * 0.8, 0, Math.PI * 1.6); g.stroke(); }
      else {
        const rr = mood === 'wide' ? r * 1.35 : r;
        circ(g, ex, y, rr, '#2a1f2e');
        circ(g, ex + look * rr * 0.3 - rr * 0.3, y - rr * 0.35, rr * 0.38, '#ffffff');
      }
    }
  }
  function mouth(g, x, y, w, kind) {
    g.lineWidth = 2.5; g.strokeStyle = '#2a1f2e'; g.lineCap = 'round';
    g.beginPath();
    if (kind === 'smile') g.arc(x, y - w * 0.3, w, Math.PI * 0.2, Math.PI * 0.8);
    else if (kind === 'open') { ell(g, x, y + 2, w * 0.55, w * 0.65, '#7a2a3a'); return; }
    else if (kind === 'o') { ell(g, x, y + 2, w * 0.3, w * 0.38, '#7a2a3a'); return; }
    else if (kind === 'wavy') { g.moveTo(x - w, y); g.quadraticCurveTo(x - w / 2, y - 4, x, y); g.quadraticCurveTo(x + w / 2, y + 4, x + w, y); }
    else if (kind === 'flat') { g.moveTo(x - w * 0.6, y); g.lineTo(x + w * 0.6, y); }
    else g.arc(x, y - w * 0.5, w * 0.7, Math.PI * 0.25, Math.PI * 0.75);
    g.stroke();
  }
  function blush(g, x, y, gap, r) { g.globalAlpha *= 0.45; ell(g, x - gap, y, r, r * 0.6, '#ff7a8a'); ell(g, x + gap, y, r, r * 0.6, '#ff7a8a'); g.globalAlpha /= 0.45; }
  // 汗マーク
  function sweat(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y - 8 * s); g.quadraticCurveTo(x + 6 * s, y + 2 * s, x, y + 4 * s); g.quadraticCurveTo(x - 6 * s, y + 2 * s, x, y - 8 * s);
    g.fillStyle = '#8fd3ff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#3a8ccf'; g.stroke();
  }
  let FONT = null;
  function text(g, s, x, y, size, fill, stroke, align = 'center', weight = 800) {
    if (!FONT) FONT = getComputedStyle(document.body).fontFamily;
    // 大きな文字（演出の見出し）はファンクな見出し用フォント
    g.font = size >= 20 ? `400 ${size}px "Dela Gothic One", ${FONT}` : `${weight} ${size}px ${FONT}`;
    g.textAlign = align; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size / 5; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = fill; g.fillText(s, x, y);
  }
  // 音符マーク
  function note(g, x, y, s, color) {
    g.save(); g.translate(x, y); g.scale(s, s);
    ell(g, 0, 0, 6, 4.5, color); line(g, 5, -1, 5, -18, color, 2.2); line(g, 5, -18, 11, -13, color, 2.2);
    g.restore();
  }
  // サングラス（ノリノリのとき・ファンクなキャラ）。gap=目の間隔の半分、r=レンズの大きさ
  function shades(g, x, y, gap, r, tint = '#1a1028') {
    g.save();
    g.fillStyle = tint; g.strokeStyle = '#000'; g.lineWidth = 2;
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(x + s * gap - r * 1.2, y - r * 0.7); g.lineTo(x + s * gap + r * 1.2, y - r * 0.7); g.quadraticCurveTo(x + s * gap + r * 1.1, y + r * 1.1, x + s * gap, y + r * 0.9); g.quadraticCurveTo(x + s * gap - r * 1.1, y + r * 1.1, x + s * gap - r * 1.2, y - r * 0.7); g.fill(); g.stroke(); });
    line(g, x - gap + r * 1.2, y - r * 0.6, x + gap - r * 1.2, y - r * 0.6, '#000', 2.5);
    g.globalAlpha *= 0.7; line(g, x - gap - r * 0.6, y - r * 0.3, x - gap - r * 0.1, y - r * 0.3, '#fff', 2); g.globalAlpha /= 0.7;
    g.restore();
  }
  return { shades, TAU, ell, circ, rrect, star, crescent, line, eyes, mouth, blush, sweat, text, note };
})();
