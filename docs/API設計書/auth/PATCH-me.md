# PATCH /api/auth/me

## 概要

ログインユーザーの表示名を変更する。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

ボディ（JSON）:

| フィールド  | 型     | 必須 | 制約              |
| ----------- | ------ | ---- | ----------------- |
| displayName | string | 必須 | trim後 1〜50 文字 |

```json
{ "displayName": "新しい表示名" }
```

## レスポンス

`200 OK` … [GET /api/auth/me](./GET-me.md) と同じ形（更新後）。

## エラー

| HTTP | code               | 条件             |
| ---- | ------------------ | ---------------- |
| 400  | `VALIDATION_ERROR` | 空・50文字超など |
| 401  | `UNAUTHORIZED`     | 未ログイン       |

## 例

```bash
curl -s -X PATCH http://localhost:8787/api/auth/me \
  -b cookie.txt -H 'content-type: application/json' \
  -d '{"displayName":"よね"}'
```

## 処理仕様

- 変更対象は本人（セッションの `userId`）のみ。
- Zod `updateProfileSchema` で検証（`z.string().trim().min(1).max(50)`）。
- 再ログイン時に Google 名で上書きされないため、ここで変えた名前は維持される。

## 実装

- [server/src/routes/auth.ts](../../../server/src/routes/auth.ts)
- [server/src/repositories/users.ts](../../../server/src/repositories/users.ts) … `updateDisplayName`
