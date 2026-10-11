// Web版(web/index.html)の描画コードを使って、ウィジェット / Dynamic Island 用の画像を書き出す。
// 使い方: node tools/render-sprites.cjs   (要 playwright)
const path = require("path");
const fs = require("fs");
let pw;
try { pw = require("playwright"); } catch { pw = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); }

const ROOT = path.resolve(__dirname, "..");
const WEB = path.resolve(ROOT, "../web/index.html");
const SPRITES = path.join(ROOT, "Shared/Sprites.xcassets");
const ICON = path.join(ROOT, "PocketPet/Assets.xcassets/AppIcon.appiconset");

(async () => {
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + WEB);
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    const res = {};
    const POSES = {
      sit: (b) => ({ posture: "sit", mouth: b.sp === "dog" ? "pant" : "smile" }),
      wave: (b) => ({ posture: "sit", pawUp: 0.95, eyes: "happy", blush: true, mouth: b.sp === "dog" ? "pant" : "open" }),
      happy: (b) => ({ hop: -6, walkAmp: 0.4, walkPhase: 1, eyes: "happy", blush: true, mouth: b.sp === "dog" ? "pant" : "open", tailAngle: 15 }),
      walk: () => ({ walkAmp: 1, walkPhase: 1.2 }),
      sleep: () => ({ posture: "curl", eyes: "sleep", mouth: "none" }),
      lie: () => ({ posture: "lie", eyes: "half" }),
      stretch: () => ({ posture: "stretch", eyes: "happy", mouth: "open" }),
      eat: () => ({ headDx: 6, headDy: 15, bodyTilt: 6, mouth: "chew", chew: 0.8, eyes: "happy" }),
      petted: (b) => ({ posture: "sit", eyes: "heart", blush: true, headTilt: -8, mouth: b.sp === "dog" ? "pant" : "smile" }),
      beg: (b) => ({ posture: "sit", headTilt: 14, pawUp: b.sp === "dog" ? 0.65 : 0, mouth: "open" }),
      lonely: () => ({ posture: "sit", headTilt: -12, mouth: "open", tailAngle: 20 }),
    };
    const FACES = { face: { eyes: "open" }, face_sleep: { eyes: "sleep", mouth: "none" }, face_happy: { eyes: "happy", blush: true, mouth: "open" } };
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    for (const b of BREEDS) {
      for (const [name, f] of Object.entries(POSES)) {
        const cv = mk(300, 270), c = cv.getContext("2d");
        c.translate(150, 262); c.scale(2.4, 2.4);
        const p = Object.assign(newPose(), f(b));
        Renderer.draw(c, p, b);
        if (name === "eat") Renderer.treat(c, b.sp, 46, -6, 1.1);
        c.textAlign = "center";
        if (name === "sleep") {
          c.fillStyle = "#6E82C8"; c.font = '900 13px sans-serif'; c.fillText("z", 30, -40);
          c.font = '900 18px sans-serif'; c.fillText("Z", 42, -56);
        }
        if (name === "petted") { c.fillStyle = "#FF5A82"; heartPath(c, 26, -90, 6); c.fill(); heartPath(c, -12, -96, 4.5); c.fill(); }
        if (name === "beg" || name === "lonely") { c.fillStyle = "#5A78DC"; c.font = '900 16px sans-serif'; c.fillText("?", 30, -86); }
        res[`${b.id}_${name}`] = cv.toDataURL("image/png");
      }
      for (const [name, f] of Object.entries(FACES)) {
        const cv = mk(150, 150), c = cv.getContext("2d");
        c.translate(75, 84); c.scale(2.6, 2.6); c.lineCap = "round"; c.lineJoin = "round";
        Renderer.b = b; Renderer.c = c;
        Renderer.head(0, 0, 19, Object.assign(newPose(), { look: 0 }, f));
        res[`${b.id}_${name}`] = cv.toDataURL("image/png");
      }
    }
    // アプリアイコン(1024px, 透過なし)
    const cv = mk(1024, 1024), c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, "#CFE9FF"); g.addColorStop(0.7, "#F4FAFF"); g.addColorStop(0.7, "#E3F1D6"); g.addColorStop(1, "#E3F1D6");
    c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
    c.translate(512, 900); c.scale(8.4, 8.4);
    Renderer.draw(c, Object.assign(newPose(), { posture: "sit", eyes: "happy", blush: true, mouth: "open", pawUp: 0.95 }), BREEDS[0]);
    res["__icon"] = cv.toDataURL("image/png");
    return res;
  });
  await browser.close();

  fs.rmSync(SPRITES, { recursive: true, force: true });
  fs.mkdirSync(SPRITES, { recursive: true });
  fs.writeFileSync(path.join(SPRITES, "Contents.json"), JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2));
  let n = 0;
  for (const [name, url] of Object.entries(out)) {
    const png = Buffer.from(url.split(",")[1], "base64");
    if (name === "__icon") {
      fs.mkdirSync(ICON, { recursive: true });
      fs.writeFileSync(path.join(ICON, "icon.png"), png);
      fs.writeFileSync(path.join(ICON, "Contents.json"), JSON.stringify({
        images: [{ filename: "icon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
        info: { author: "xcode", version: 1 },
      }, null, 2));
      continue;
    }
    const dir = path.join(SPRITES, `${name}.imageset`);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, `${name}.png`), png);
    fs.writeFileSync(path.join(dir, "Contents.json"), JSON.stringify({
      images: [{ filename: `${name}.png`, idiom: "universal", scale: "3x" }],
      info: { author: "xcode", version: 1 },
    }, null, 2));
    n++;
  }
  console.log(`sprites: ${n}`);
})();
