// GET /api/license?code=GH-XXXX-XXXX-XXXX → 購入済みコースの一覧
import { json, CODE_RE, coursesOf } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!CODE_RE.test(code)) return json({ error: "コードの形式が違います" }, 400);
  return json({ courses: await coursesOf(env, code) });
}
