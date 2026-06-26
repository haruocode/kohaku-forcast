# デプロイ手順（Cloudflare）

API（Workers）と フロント（SPA）を **1つの Worker** から同一オリジンで配信する。
Cookie / Google OAuth が同一オリジンで完結するため、CORS や SameSite の問題が起きない。

- API: `/api/*`（Hono / Workers）
- 画面: それ以外のパス（`web/dist` を静的アセットとして配信、SPAフォールバック）

本番は `wrangler.jsonc` の `env.production` を使う（`--env production`）。

---

## 0. 前提

- Cloudflare アカウント
- Google Cloud Console で OAuth 2.0 クライアント（後述）
- ローカルに wrangler ログイン: `npx wrangler login`

## 1. D1 データベースを作成

```bash
cd server
npx wrangler d1 create kohaku-db
```

出力された `database_id` を `wrangler.jsonc` の **2か所**（トップレベルと `env.production`）の
`REPLACE_WITH_D1_DATABASE_ID` に貼る。

## 2. リモートDBにマイグレーションを適用

```bash
cd server
npx wrangler d1 migrations apply kohaku-db --remote
# 任意: サンプルデータを入れる場合
# npx wrangler d1 execute kohaku-db --remote --file ./seed.sql
```

## 3. フロントをビルド

```bash
cd web
pnpm build      # -> web/dist（Workerがアセットとして配信する）
```

## 4. シークレットを登録（本番）

> 値はコミットしない。`wrangler secret put` は対話入力。

```bash
cd server
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
npx wrangler secret put SESSION_SECRET --env production        # 十分長いランダム文字列
# 記念トークンを使う場合（後日）
# npx wrangler secret put SOLANA_RPC_URL --env production
# npx wrangler secret put TOKEN_MINT_ADDRESS --env production
# npx wrangler secret put MINT_AUTHORITY_SECRET --env production
```

## 5. 本番URLを設定

デプロイ先のホスト（`https://kohaku-forecast.<account>.workers.dev` か独自ドメイン）に合わせて
`wrangler.jsonc` の `env.production.vars.OAUTH_REDIRECT_URI` を
`https://<本番ホスト>/api/auth/google/callback` に書き換える。

## 6. デプロイ

```bash
cd server
npx wrangler deploy --env production
```

`web/dist` がアセットとして同梱され、API と画面が同一オリジンで公開される。

## 7. Google OAuth クライアント設定

Google Cloud Console → 認証情報 → OAuth 2.0 クライアント:

- 承認済みリダイレクトURI: `https://<本番ホスト>/api/auth/google/callback`
- 取得した client id / secret を手順4で登録

## 8. 管理者を有効化

初回ログイン後、自分を管理者にする:

```bash
cd server
npx wrangler d1 execute kohaku-db --remote \
  --command "UPDATE users SET is_admin=1 WHERE email='あなたのGmail';"
```

その後、管理APIでシーズン作成・アーティスト追加・結果確定・締切操作ができる。

---

## ローカル開発（参考）

本番と違い、フロントは Vite(5173)、API は Worker(8787)で別々に起動し、
Vite の proxy が `/api` を Worker へ転送する（`web/vite.config.ts`）。

```bash
cd server && pnpm db:migrate:local && pnpm db:seed:local && pnpm dev   # :8787
cd web && pnpm dev                                                     # :5173
```

ローカルの OAuth は `server/.dev.vars`（`.dev.vars.example` 参照）に設定する。
