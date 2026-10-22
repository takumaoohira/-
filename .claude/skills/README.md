# プロジェクト用 Claude Code スキル

このフォルダ（`.claude/skills/`）で、このリポジトリ専用の Claude Code スキルを管理します。
ここに置いたスキルは、このリポジトリで Claude Code を起動すると自動で読み込まれ、
Git でコミットすればチーム（他のセッション・他の端末）でも共有できます。

## フォルダ構成

```
.claude/skills/
├── README.md              ← このファイル（管理ルール）
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

スキルを追加したら、この表も更新してください。

## 参考：このリポジトリ以外で使えるスキル

プロジェクト外（ユーザー共通・組織共通）にも以下のスキルが既にあります。
同じ機能のスキルをここに重複して作る必要はありません。

- docx / xlsx / pptx / pdf（Office・PDF ファイルの作成・編集）
- docs（共有・コメントできるドキュメント）
- skill-creator（スキルの作成・改善・評価）
- deep-research（Web 調査レポート）
- google-workspace（Google ドキュメント・スプレッドシート・スライド）
- session-start-hook（クラウドセッション起動時のフック作成）
