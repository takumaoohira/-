# プロジェクト用 Claude Code スキル

このフォルダ（`.claude/skills/`）で、このリポジトリ専用の Claude Code スキルを管理します。
ここに置いたスキルは、このリポジトリで Claude Code を起動すると自動で読み込まれ、
Git でコミットすればチーム（他のセッション・他の端末）でも共有できます。

## フォルダ構成

```
.claude/skills/
├── README.md              ← このファイル（管理ルール）
├── _licenses/             ← 外部から取り込んだスキルのライセンス
├── _template/
│   └── SKILL.md.template  ← 新規スキル作成用のひな形（読み込まれません）
└── <スキル名>/            ← 1スキル = 1フォルダ
    ├── SKILL.md           ← 必須：スキル本体
    ├── templates/         ← 任意：書類・申請書などのひな形
    ├── references/        ← 任意：参考資料（料金表、社内ルールなど）
    └── scripts/           ← 任意：補助スクリプト
```

## スキルの追加手順

1. ひな形をコピーして新しいフォルダを作る
   ```bash
   mkdir -p .claude/skills/<スキル名>
   cp .claude/skills/_template/SKILL.md.template .claude/skills/<スキル名>/SKILL.md
   ```
2. `SKILL.md` 冒頭の `name` と `description` を書き換える
   - `name`：フォルダ名と同じ、英小文字・数字・ハイフンのみ（例：`campaign-flyer`）
   - `description`：**いつ使うスキルか**を具体的に書く。Claude はこの文を見て使うか判断します
3. 本文に手順・ルール・出力形式を書く
4. コミットしてプッシュ
5. Claude Code で `/<スキル名>` と入力するか、該当する依頼をすると呼び出されます
   （起動中のセッションには反映されないことがあるので、新しいセッションで確認してください）

## 命名ルール

| 用途 | 例 |
|---|---|
| 販促物の作成 | `campaign-flyer`, `sns-post` |
| 書類作成 | `meeting-minutes`, `report-monthly` |
| 社内申請 | `expense-request`, `leave-request` |

## 現在のスキル一覧

| スキル名 | 内容 |
|---|---|
| `claude-automation-recommender` | Anthropic公式「claude-code-setup」プラグインのスキル。プロジェクトを解析し、おすすめの Claude Code 自動化（フック・スキル・MCP サーバー・サブエージェント・プラグイン）を提案する（読み取り専用）。出典：[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-code-setup)（Apache-2.0） |
| `frontend-design` | Anthropic公式「frontend-design」プラグインのスキル。Webページ・UIを作るとき、ありきたりにならない配色・書体・レイアウトでデザインするための指針。キャンペーンページやメニュー表などのHTML作成時に使う。出典：[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design)（Apache-2.0） |
| `skill-creator` | Anthropic公式スキル。新しいスキルの作成・既存スキルの改善・評価（テスト実行、description の最適化）を行う。このフォルダにスキルを追加するときに使う。出典：[anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/skill-creator)（Apache-2.0） |
| **Superpowers**（15スキル） | Jesse Vincent 作の人気スキル集（[obra/superpowers](https://github.com/obra/superpowers)、MIT、v6.4系）。主に開発作業向け。<br>`brainstorming`（アイデア出し・要件整理）／`writing-plans`（計画書作成）／`executing-plans`（計画の実行）／`subagent-driven-development`／`dispatching-parallel-agents`／`test-driven-development`／`systematic-debugging`／`verification-before-completion`（完了前の確認）／`requesting-code-review`／`receiving-code-review`／`using-git-worktrees`／`finishing-a-development-branch`／`writing-skills`（スキル作成）／`using-superpowers`（使い方の入口）／`diagnosing-superpowers`（不具合診断）<br>※ `brainstorming` のブラウザ画面機能は外部ロゴ画像を読み込む。止めるには環境変数 `SUPERPOWERS_DISABLE_TELEMETRY=1` |
| `playwright-cli` | Microsoft 公式の Playwright スキル（[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)、Apache-2.0）。ブラウザを操作してWebページを開く・クリック・入力・スクリーンショット・PDF保存・動作テストを行う。作ったHTMLページの表示確認（スマホ表示含む）にも使える。※ `playwright-cli` コマンドが必要（`npm install -g @playwright/cli@latest`） |
| `agent-development` | Anthropic公式「plugin-dev」プラグインのスキル（[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/plugin-dev)、Apache-2.0）。サブエージェント（専門の助手役）の作り方：設定項目、呼び出される条件の書き方、指示文の設計、例、検証スクリプト（`scripts/validate-agent.sh`）。※ 説明はプラグイン向けだが、このリポジトリでは作ったエージェントを `.claude/agents/<名前>.md` に置く |

スキルを追加したら、この表も更新してください。

## 参考：このリポジトリ以外で使えるスキル

プロジェクト外（ユーザー共通・組織共通）にも以下のスキルが既にあります。
同じ機能のスキルをここに重複して作る必要はありません。

- docx / xlsx / pptx / pdf（Office・PDF ファイルの作成・編集）
- docs（共有・コメントできるドキュメント）
- deep-research（Web 調査レポート）
- google-workspace（Google ドキュメント・スプレッドシート・スライド）
- session-start-hook（クラウドセッション起動時のフック作成）

## 参考：Dynamic workflows（動的ワークフロー）

Dynamic workflows は **Claude Code に最初から入っている機能** で、スキルとして追加するものではありません
（関連スキル `/workflow-authoring` も Claude Code に同梱。v2.1.248 以降）。
Claude が「たくさんのサブエージェントを動かす台本（JavaScript）」を書き、裏で並行実行します。

- 使い方：依頼文に `ultracode` を入れる、または「ワークフローで〜して」と頼む
  - 例：`ultracode: rakuspa-campaign と rakuspa-menu の表記ゆれ・料金の食い違いを全部洗い出して`
- 試す：`/deep-research <調べたいこと>`（同梱のワークフロー。複数の情報源を突き合わせてレポート）
- 進み具合：`/workflows`
- 保存：`/workflows` で実行結果を選び `s` → **`.claude/workflows/`** を選ぶとこのリポジトリで共有され、次回から `/<名前>` で呼べる
- 注意：トークン（利用枠）を多く使うので、大きな作業の前は小さい範囲で試す。オフにするには `/config` の Dynamic workflows
- 公式ドキュメント：https://code.claude.com/docs/en/workflows
