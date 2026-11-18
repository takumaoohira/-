// ローカル確認用の「にせStripe」：決済ページを開くとすぐ支払い済みにして success_url に戻す
const http = require("http");
const sessions = new Map();
let n = 0;
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.method === "POST" && u.pathname === "/v1/checkout/sessions") {
      if (req.headers.authorization !== "Bearer sk_test_mock") return send({ error: { message: "bad key" } }, 401);
      const p = new URLSearchParams(body), id = "cs_test_mock" + (++n) + "abcdef";
      const s = { id, object: "checkout.session", payment_status: "unpaid", currency: p.get("line_items[0][price_data][currency]"),
        amount_total: +p.get("line_items[0][price_data][unit_amount]"), metadata: { course: p.get("metadata[course]"), code: p.get("metadata[code]") },
        payment_intent: "pi_mock" + n, success_url: p.get("success_url"), description: p.get("payment_intent_data[description]"), submit_msg: p.get("custom_text[submit][message]"),
        url: `http://127.0.0.1:12111/pay/${id}` };
      sessions.set(id, s); console.log("CREATE", id, s.metadata, s.amount_total, s.description); return send(s);
    }
    let m;
    if ((m = u.pathname.match(/^\/v1\/checkout\/sessions\/(.+)$/))) { const s = sessions.get(m[1]); return s ? send(s) : send({ error: { message: "No such session" } }, 404); }
    if ((m = u.pathname.match(/^\/pay\/(.+)$/))) { const s = sessions.get(m[1]); s.payment_status = "paid";
      res.writeHead(302, { location: s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id) }); return res.end(); }
    if (u.pathname === "/_last") return send([...sessions.values()].pop() || null);
    send({ error: { message: "not found" } }, 404);
  });
}).listen(12111, () => console.log("mock stripe on 12111"));
