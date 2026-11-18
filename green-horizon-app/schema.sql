-- 購入履歴（1回の決済＝1行）。復元コード（code）ごとに購入済みコースをまとめて管理する。
-- メールアドレスやカード情報はここには保存しない（Stripe 側にのみ保存される）。
CREATE TABLE IF NOT EXISTS entitlements (
  session_id     TEXT PRIMARY KEY,          -- Stripe Checkout セッションID（重複登録を防ぐ）
  code           TEXT NOT NULL,             -- 復元コード GH-XXXX-XXXX-XXXX
  course         TEXT NOT NULL,             -- コースID（world / tenrei など）
  payment_intent TEXT,                      -- 返金の照合用
  amount         INTEGER NOT NULL,          -- 金額（円）
  currency       TEXT NOT NULL,
  revoked        INTEGER NOT NULL DEFAULT 0, -- 返金・チャージバックで 1
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ent_code ON entitlements(code);
CREATE INDEX IF NOT EXISTS idx_ent_pi ON entitlements(payment_intent);
