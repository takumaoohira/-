// GET /api/course?id=world&code=GH-... → 購入済みの場合だけコースデータ（ホール情報）を返す
import { json, CODE_RE, DATA, coursesOf } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const id = q.get("id") || "", code = q.get("code") || "";
  if (!DATA[id] || !CODE_RE.test(code)) return json({ error: "不正なリクエスト" }, 400);
  const owned = await coursesOf(env, code);
  if (!owned.includes(id)) return json({ error: "このコースは購入されていません" }, 403);
  return json(DATA[id]);
}
