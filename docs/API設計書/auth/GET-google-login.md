# GET /api/auth/google/login

## 概要

Google OAuth 2.0（OpenID Connect）の認可画面へリダイレクトする。ログイン導線の入口。

## 認可

公開（認証不要）。

## リクエスト

なし（クエリ・ボディなし）。

## レスポンス

`302 Found` … Google の認可URLへリダイレクト。

副作用として CSRF 対策の `state` を生成し、`oauth_state` Cookie に保存する。

| Cookie        | 属性                                                                |
| ------------- | ------------------------------------------------------------------- |
| `oauth_state` | HttpOnly / SameSite=Lax / Secure(httpsのみ) / Path=/ / maxAge 600秒 |

## エラー

なし（常にリダイレクト）。`GOOGLE_CLIENT_ID` 未設定など環境不備時は後続のコールバックで失敗する。

## 例

```bash
# ブラウザで開く
http://localhost:5173/api/auth/google/login
```

## 処理仕様

1. `crypto.randomUUID()` で `state` を生成し `oauth_state` Cookie に保存。
2. 認可URLを組み立ててリダイレクト。リダイレクトURIは `OAUTH_REDIRECT_URI`、
   未設定ならリクエストのオリジン + `/api/auth/google/callback` を使う。
3. 実際の照合・セッション発行は [GET /api/auth/google/callback](./GET-google-callback.md) で行う。

## 実装

- [server/src/routes/auth.ts](../../../server/src/routes/auth.ts)
- [server/src/auth/google.ts](../../../server/src/auth/google.ts) … `buildAuthorizationUrl`
