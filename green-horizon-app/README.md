# GREEN HORIZON 公開版（Webアプリ・コース販売）

Instagram のリンクからそのまま遊べる、スマホ向けのWebアプリ版です。アプリのダウンロードは不要です。

- **無料**：小田原城CC
- **有料（1コース 税込100円・買い切り）**：ワールドヘリテージGC、天嶺ゴルフクラブ
- iPhone（Safari・Instagram内ブラウザ）と Android（Chrome・Instagram内ブラウザ）で動作します。
- 「ホーム画面に追加」すると、アプリのように全画面で起動できます（PWA）。

## 仕組み

```
Instagram のリンク
   ↓
Cloudflare Pages（ゲーム本体・法的表記ページ）
   ├─ /api/checkout       購入ボタン → Stripe の決済ページへ
   ├─ /api/claim          決済後に戻ってきたとき、支払い済みかを Stripe に確認して購入を記録
   ├─ /api/stripe-webhook Stripe からの通知（購入・返金）を署名付きで受け取る
   ├─ /api/license        復元コードで購入済みコースを確認
   └─ /api/course         購入済みの人にだけ有料コースのホール情報を配信
Cloudflare D1（購入履歴のデータベース）
Stripe（カード・Apple Pay・Google Pay の決済。カード情報やメールアドレスは Stripe だけが保持）
```

- 有料コースのホール情報はゲーム本体には入っておらず、購入済みの人だけがサーバーから受け取ります。
- 購入すると **復元コード**（例：`GH-ABCD-EFGH-JKLM`）が発行されます。完了画面と Stripe の領収書メールに記載されます。ブラウザを変えたときや機種変更のときは「購入・復元」でコードを入力します。
- 2つ目以降の購入は同じ復元コードにまとまります。
- Stripe で返金すると、そのコースは自動で使えなくなります。チャージバック（カード会社への異議申し立て）でも同じです。

## ファイル

| ファイル | 内容 |
|---|---|
| `shop.config.json` | 販売者名・メールアドレス・公開URL・価格など。**公開前に【要記入】を埋める** |
| `build.py` | `../odawarajo-cc/fpv-sim.html` から公開用ファイル（`public/`）と有料コースのデータ（`functions/_data/`）を作る |
| `functions/` | サーバー側の処理（Cloudflare Pages Functions） |
| `schema.sql` | 購入履歴のテーブル |
| `legal/` | 特定商取引法に基づく表記・利用規約・プライバシーポリシーのひな形 |
| `sw.template.js` | オフライン対応・高速化の Service Worker |
| `test/mock-stripe.js` | ローカル確認用の「にせStripe」 |

ゲームを更新したら `python3 build.py` を実行し、もう一度デプロイします。

## 公開までの手順

### 1. Stripe（決済）

1. https://dashboard.stripe.com/register でアカウントを作成します。事業形態は「個人事業主」を選びます。
2. 本人確認書類・銀行口座（売上の振込先）・電話番号を登録します。ビジネスのWebサイトには公開URLを入れます（手順3で決まります）。
3. 「設定 → ビジネス → 公開情報」で、明細書表記（例：`GREEN HORIZON`）とカナ表記を設定します。
4. 「設定 → カスタマーへのメール」で **成功した支払いの領収書** をオンにします。これで復元コード入りの領収書が購入者に届きます。
5. まずは **テスト環境** で、「開発者 → APIキー」のシークレットキー（`sk_test_...`）を控えます。
6. 「開発者 → Webhook → エンドポイントを追加」で次のように設定し、署名シークレット（`whsec_...`）を控えます。
   - URL：`https://（公開URL）/api/stripe-webhook`
   - イベント：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`、`charge.dispute.created`

手数料は決済1件ごとに3.6%（100円なら約4円）です。月額料金はかかりません。

### 2. Cloudflare（公開サーバー）

1. https://dash.cloudflare.com/sign-up でアカウントを作成します（無料プランで足ります）。
2. このフォルダで次を実行します（Node.js 18 以上が必要）。

```bash
npm install
npx wrangler login                       # ブラウザでCloudflareにログイン
npx wrangler d1 create green-horizon     # 表示された database_id を wrangler.toml に書く
npm run db:remote                        # 購入履歴のテーブルを作る
npx wrangler pages project create green-horizon --production-branch main
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name green-horizon      # sk_test_... を貼り付け
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name green-horizon  # whsec_... を貼り付け
```

3. Cloudflare の管理画面の「Workers & Pages → green-horizon → 設定 → バインディング」で、D1 データベース `green-horizon` が変数名 `DB` で接続されていることを確認します。
4. 公開URLは `https://green-horizon.pages.dev` になります。名前が使われている場合は別の名前になります。独自ドメイン（年1,500円前後）も後から設定できます。

### 3. 設定を記入して公開

1. `shop.config.json` の【要記入】をすべて埋めます（販売者名・運営責任者・メールアドレス・公開URL・施行日）。
2. `npm run deploy` を実行します（ビルドと公開をまとめて行います）。
3. スマホで公開URLを開き、テストカード `4242 4242 4242 4242`（有効期限は未来の日付、CVCは任意の3桁）で購入できるか確かめます。テスト環境ではお金は動きません。

### 4. 本番の決済に切り替える

1. Stripe の「本番環境」で、本番用のシークレットキー（`sk_live_...`）と本番用の Webhook（手順1-6と同じ設定）を作ります。
2. `npx wrangler pages secret put` で2つの値を本番用に置き換え、`npm run deploy` します。
3. 自分で1回購入して動作を確認し、Stripe から返金します。返金するとコースがロックに戻ることも確認できます。

### 5. Instagram に載せる

- プロフィールの「リンク」に公開URLを追加します。
- ストーリーズでは「リンク」スタンプに公開URLを貼ります。
- Instagram 内のブラウザでもそのまま遊べて購入もできます。ホーム画面に追加したいときは、右上の「…」→「外部ブラウザで開く」から行います（ゲーム画面にも案内を出しています）。

## ローカルで確かめる（任意）

```bash
cp .dev.vars.example .dev.vars    # 「にせStripe」を使うなら STRIPE_SECRET_KEY=sk_test_mock と STRIPE_API_BASE=http://127.0.0.1:12111 を書く
npm run db:local
node test/mock-stripe.js &        # にせStripe（決済ページを開くと即「支払い済み」になって戻る）
npm run dev                       # http://127.0.0.1:8788
```

## 運営で必要になること

- **お問い合わせ対応**：特定商取引法の表記に載せたメールアドレスに届きます。
- **返金**：Stripe の管理画面で返金すると、自動でコースが使えなくなります。
- **確定申告**：売上は個人の所得になります。年間の所得によっては申告が必要です。Stripe の管理画面から売上レポートをダウンロードできます。
- **費用**：Stripe 手数料のみです（Cloudflare は無料枠の範囲：1日10万リクエスト・データベース5GB）。
