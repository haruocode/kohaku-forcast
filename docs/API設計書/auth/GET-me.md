# GET /api/auth/me

## 概要

現在のログインユーザーを返す。フロントのログイン状態判定に使う（`useMe`）。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

なし。

## レスポンス

`200 OK`

```json
{
  "id": "uuid",
  "displayName": "ユーザー名",
  "email": "user@example.com",
  "avatarUrl": "https://.../photo.jpg",
  "isAdmin": false
}
```

| フィールド  | 型             | 説明        |
| ----------- | -------------- | ----------- |
| id          | string         | ユーザーID  |
| displayName | string         | 表示名      |
| email       | string         | メール      |
| avatarUrl   | string \| null | アバターURL |
| isAdmin     | boolean        | 管理者か    |

> `solana_address` 等の内部項目は返さない。

## エラー

| HTTP | code           | 条件                                                   |
| ---- | -------------- | ------------------------------------------------------ |
| 401  | `UNAUTHORIZED` | 未ログイン                                             |
| 404  | `NOT_FOUND`    | セッションは有効だがユーザーが存在しない（削除済み等） |

## 例

```bash
curl -s http://localhost:8787/api/auth/me -b cookie.txt
```

## 実装

- [server/src/routes/auth.ts](../../../server/src/routes/auth.ts)
- [server/src/repositories/users.ts](../../../server/src/repositories/users.ts) … `findUserById`
