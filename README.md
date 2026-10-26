# Lumii

Discord multi-function bot (English only). All bot messages are **ComponentsV2** panels.

Stack: Node.js 20+ / TypeScript / discord.js 14 / Prisma (Neon PostgreSQL) / Render + UptimeRobot

## セットアップ

```bash
pnpm install
cp .env.example .env                                   # Bot用 (DISCORD_TOKEN など)
cp packages/database/.env.example packages/database/.env   # Prisma CLI用 (DATABASE_URL / DIRECT_URL)

pnpm db:generate     # Prismaクライアント生成 (install時にも自動実行)
pnpm db:build        # database パッケージをビルド
pnpm db:push         # スキーマをDBに反映
pnpm bot:deploy-commands   # スラッシュコマンド登録 (DEV_GUILD_ID を設定すると即時反映)
pnpm bot:dev         # 開発起動 (tsx watch)
```

## デプロイ (GitHub + Neon + Render + UptimeRobot)

1. **GitHub**: このフォルダを **Private** リポジトリにpushする (`.env` は `.gitignore` 済み。`pnpm-lock.yaml` は必ずコミットする)
2. **Neon**: プロジェクトの **Connect** から接続文字列を2つ取得する
   - Connection pooling **ON** (ホスト名に `-pooler`) → `DATABASE_URL`
   - Connection pooling **OFF** → `DIRECT_URL`
3. **Render**: **New → Blueprint** でリポジトリを選び、`render.yaml` を読み込む。聞かれる環境変数に
   `DISCORD_TOKEN` / `DISCORD_CLIENT_ID` / `DATABASE_URL` / `DIRECT_URL` を入力する
   (ビルド時にテーブル作成 `prisma db push` も自動で走る)
4. **UptimeRobot**: **HTTP(s)** モニターを作り、URLに `https://<サービス名>.onrender.com/health`、間隔は **5分** にする
   (Renderの無料枠は15分アクセスが無いとスリープするため)
5. **コマンド登録**: 手元PCで、`.env` の `DEV_GUILD_ID` を空にして `pnpm bot:deploy-commands` (グローバル登録。反映まで最大1時間)

### Neon無料枠 (月100 CU-時間) について
計算リソースは5分間アクセスが無いと自動で停止し、停止中は時間を消費しません。常時起動すると月約180 CU-時間になり、
枠を超えると**翌月までDBが止まります**。そのため Lumii は次のように作っています。

- `/health` はDBに触れない (UptimeRobotがDBを起こし続けないように)
- 抽選の終了やロックダウンの解除は、DBを定期的に読まず**タイマー**で行う (起動時に1回だけDBを読み直す)
- 使用量は Neon の **Monitoring / Usage** で確認できる

## 構成

```
apps/bot/src/
├─ index.ts / client.ts / env.ts / config.ts / health.ts
├─ core/        loader(自動検出) / router(インタラクション振り分け) / panel(ComponentsV2) / scheduler / types
├─ scripts/     deploy-commands / clear-commands
└─ modules/     機能ごとのフォルダ (index.ts が default export で defineModule を返す)
   ├─ _shared/  複数モジュールで共有するコード (自動検出の対象外)
   └─ general, honeypot, verification, welcome, youtube, levels, clan, lfp,
      giveaways, anti-raid, anti-nuke
```

### 機能の追加方法
`modules/<name>/index.ts` を作って `export default defineModule({ name, commands, events, interactions, onReady })` するだけで自動で読み込まれます。

### customId の規則
`<module>:<action>[:<data>]` 例) `clan:apply` / `lfp:submit` / `levels:celebrate:<messageId>:<userId>`
`interactions` の `prefix` が customId の先頭と一致したハンドラに振り分けられます。

### ComponentsV2 のルール
`core/panel.ts` の `panel()` / `v2()` / `v2Ephemeral()` / `notice` を使います。
V2メッセージには `content` と `embeds` を付けられません (文字は TextDisplay に入れます)。

## 実装状況

| モジュール | 状態 |
|---|---|
| general (`/ping`) | Done |
| clan (`/clan-setup`) | Done 常設パネル → モーダル → 管理者チャンネルへ送信 |
| lfp (`/lfp-setup`) | Done 常設パネル → モーダル → 公開チャンネルへ投稿 |
| youtube | In progress 10分ごとの定期実行まで (RSS取得・通知は TODO。実装時は購読一覧をメモリに保持し、DBは新着動画の記録時だけ使う) |
| levels (+ 祝福パネル) | Done `/rank` `/leaderboard` `/level-config` `/level-role` `/level-noxp` `/level-test` |
| verification | Done `/verification-setup` `/verification-config` (画像コード認証) |
| welcome | Done `/welcome-config` `/welcome-test` |
| giveaways | Done `/giveaway start\|end\|cancel\|reroll\|list\|entrants` |
| anti-raid | Done `/antiraid-config` `/antiraid-unlock` |
| anti-nuke | Planned Nyxから移植予定 |
| private-vc | 実装しない(不採用) |
| honeypot | Planned 新規 |

## 表示ルール

- Botが出すテキスト・ボタン・パネルに**絵文字は使わない**。強調や区別はDiscordのマークアップで行う。
- パネルの基本形は Nyx と同じ: `## 見出し` → 空行 → 本文 → 区切り線 → ボタン → 区切り線 → `-# クレジット`。
- 注意・ヒントは `callout.warning()` / `callout.tip()`(太字ラベル)を使う。
- 使うマークアップ: `##` 見出し、`**太字**`、`> 引用`、`` `コード` ``、`-#` サブテキスト、`<#チャンネル>` `<@&ロール>` `<t:UNIX:R>` などのメンション/日時表記。
