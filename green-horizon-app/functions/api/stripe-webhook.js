// POST /api/stripe-webhook ← Stripe からの通知（署名を検証してから処理）
//   checkout.session.completed / async_payment_succeeded → 購入を記録
//   charge.refunded（全額返金） / charge.dispute.created → 購入を取り消し
import { json, grant } from "../_lib.js";

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function verify(body, header, secret) {
  if (!header || !secret) return false;
  let t = null; const sigs = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = v; else if (k === "v1") sigs.push(v);
  }
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expect = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  return sigs.some((s) => s.length === expect.length && [...s].reduce((a, c, i) => a | (c.charCodeAt(0) ^ expect.charCodeAt(i)), 0) === 0);
}

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verify(body, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "invalid signature" }, 400);
  }
  const ev = JSON.parse(body), o = ev.data && ev.data.object;
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    await grant(env, o);
  } else if ((ev.type === "charge.refunded" && o.refunded) || ev.type === "charge.dispute.created") {
    const pi = String(o.payment_intent || "");
    if (pi) await env.DB.prepare("UPDATE entitlements SET revoked = 1 WHERE payment_intent = ?").bind(pi).run();
  }
  return json({ received: true });
}
