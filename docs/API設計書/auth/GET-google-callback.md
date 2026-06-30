# GET /api/auth/google/callback

## 概要

Google からのコールバックを受け、認可コードをプロフィールに交換し、ユーザーを find-or-create して
セッションを発行する。

## 認可

公開（認証不要。これ自体がログイン処理）。

## リクエスト

クエリパラメータ（Google が付与）:

| 名前  | 型     | 必須 | 説明                                              |
| ----- | ------ | ---- | ------------------------------------------------- |
| code  | string | 必須 | 認可コード                                        |
| state | string | 必須 | CSRF対策の state。`oauth_state` Cookie と一致必須 |

## レスポンス

`302 Found` … `POST_LOGIN_REDIRECT`（既定 `/`）へリダイレクト。

副作用:

- `oauth_state` Cookie を削除。
- セッション Cookie `session`（JWT/HS256）を発行（HttpOnly / SameSite=Lax / Secure(https) / 30日）。

## エラー

| HTTP | code               | 条件                                       |
| ---- | ------------------ | ------------------------------------------ |
| 400  | `VALIDATION_ERROR` | `code`/`state` 欠落、または `state` 不一致 |
| 401  | `UNAUTHORIZED`     | Google とのコード交換に失敗                |

## 処理仕様

1. `state` と `oauth_state` Cookie を照合（不一致は 400）。
2. `exchangeCodeForProfile` で `code` をアクセストークン→プロフィール（`sub`/`email`/`name`/`picture`）に交換。
3. `upsertUserByGoogleSub` で `google_sub` を照合。
   - 既存: `email` / `avatarUrl` を最新化（**表示名は上書きしない** = ユーザー編集を尊重）。
   - 新規: `displayName = name ?? email` で作成。
4. `issueSession` でセッション Cookie を発行し、`POST_LOGIN_REDIRECT` へリダイレクト。

## 実装

- [server/src/routes/auth.ts](../../../server/src/routes/auth.ts)
- [server/src/auth/google.ts](../../../server/src/auth/google.ts) … `exchangeCodeForProfile`
- [server/src/auth/session.ts](../../../server/src/auth/session.ts) … `issueSession`
- [server/src/repositories/users.ts](../../../server/src/repositories/users.ts) … `upsertUserByGoogleSub`
