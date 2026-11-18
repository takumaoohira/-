// POST /api/checkout { course, code? } → Stripe の決済ページURLを返す
import { json, PAID, CODE_RE, newCode, stripe, coursesOf, readJson } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const course = String((b && b.course) || "");
  const meta = PAID[course];
  if (!meta) return json({ error: "このコースは購入できません" }, 400);

  let code = String((b && b.code) || "");
  if (CODE_RE.test(code)) {
    const owned = await coursesOf(env, code);
    if (owned.includes(course)) return json({ owned: true, code, courses: owned });
  } else {
    code = newCode(); // 初めての購入：新しい復元コードを発行（支払い完了時に記録される）
  }

  const origin = env.SITE_URL || new URL(request.url).origin;
  try {
    const s = await stripe(env, "POST", "checkout/sessions", {
      mode: "payment",
      locale: "ja",
      submit_type: "pay",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "jpy",
      "line_items[0][price_data][unit_amount]": String(meta.price),
      "line_items[0][price_data][product_data][name]": `${meta.name}（GREEN HORIZON 追加コース）`,
      "metadata[course]": course,
      "metadata[code]": code,
      // 領収書メールに復元コードが載るよう説明欄に入れる
      "payment_intent_data[description]": `${meta.name} ／ 復元コード ${code}`,
      "payment_intent_data[metadata][course]": course,
      "payment_intent_data[metadata][code]": code,
      // 最終確認画面の表示（特定商取引法）：引渡時期とキャンセル不可
      "custom_text[submit][message]": "決済完了後すぐにコースが遊べます。デジタルコンテンツのため、購入後の返品・キャンセルはできません。",
      success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });
    return json({ url: s.url });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
