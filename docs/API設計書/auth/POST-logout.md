# POST /api/auth/logout

## 概要

ログアウトする。セッション Cookie を破棄する。

## 認可

公開（未ログインでも安全に呼べる）。

## リクエスト

なし。

## レスポンス

`200 OK`

```json
{ "ok": true }
```

副作用: `session` Cookie を削除する。

## エラー

なし。

## 例

```bash
curl -s -X POST http://localhost:8787/api/auth/logout -b cookie.txt
# {"ok":true}
```

## 処理仕様

- `clearSession` は発行時（`issueSession`）と同じ属性（Path / Secure / SameSite）で削除Cookieを送る。
  属性が一致しないとブラウザが既存Cookieと同一視せず消えないことがあるため（特に本番の Secure Cookie）。

## 実装

- [server/src/routes/auth.ts](../../../server/src/routes/auth.ts)
- [server/src/auth/session.ts](../../../server/src/auth/session.ts) … `clearSession`
