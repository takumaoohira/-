// 共通の処理（Cloudflare Pages Functions）
import COURSES from "./_data/courses.js";

export const PAID = COURSES.meta; // { コースID: { name, price } }
export const DATA = COURSES.data; // { コースID: コースデータ（ホール情報） }

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// 復元コード：紛らわしい文字（0,1,I,O）を除いた32文字 × 12桁（約60ビット）
const ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_RE = /^GH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
export function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const x of b) s += ALPH[x & 31];
  return `GH-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

// Stripe API（SDKを使わず REST を直接呼ぶ）
export async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("決済の設定が完了していません（STRIPE_SECRET_KEY 未設定）");
  const base = env.STRIPE_API_BASE || "https://api.stripe.com";
  const r = await fetch(`${base}/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Stripe エラー（${r.status}）`);
  return j;
}

export async function coursesOf(env, code) {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT course FROM entitlements WHERE code = ? AND revoked = 0"
  ).bind(code).all();
  return results.map((r) => r.course);
}

// 支払い済みの Checkout セッションを購入履歴に記録（同じセッションは1回だけ）
export async function grant(env, s) {
  if (!s || s.object !== "checkout.session" || s.payment_status !== "paid") return null;
  const course = s.metadata && s.metadata.course, code = s.metadata && s.metadata.code;
  const meta = PAID[course];
  if (!meta || !CODE_RE.test(code || "")) return null;
  if (s.currency !== "jpy" || s.amount_total !== meta.price) return null; // 金額の改ざん対策
  await env.DB.prepare(
    "INSERT OR IGNORE INTO entitlements (session_id, code, course, payment_intent, amount, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(s.id, code, course, String(s.payment_intent || ""), s.amount_total, s.currency, new Date().toISOString()).run();
  return { code, course };
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
