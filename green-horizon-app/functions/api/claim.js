// POST /api/claim { session_id } → 決済完了ページから戻ったときに購入を確定し、復元コードを返す
// （Webhook が遅れても確実に反映されるよう、Stripe に直接問い合わせて確認する）
import { json, stripe, grant, coursesOf, readJson } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = String((b && b.session_id) || "");
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return json({ error: "不正なリクエスト" }, 400);
  let s;
  try {
    s = await stripe(env, "GET", `checkout/sessions/${id}`);
  } catch (e) {
    return json({ error: e.message }, 502);
  }
  if (s.payment_status !== "paid") return json({ error: "決済が完了していません" }, 409);
  const g = await grant(env, s);
  if (!g) return json({ error: "購入情報を確認できませんでした" }, 400);
  return json({ code: g.code, course: g.course, courses: await coursesOf(env, g.code) });
}
