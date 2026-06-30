# DELETE /api/predictions/:id

## 概要

予想を取り消す（物理削除）。受付中かつ本人の予想のみ。

## 認可

要ログイン（`requireAuth`）＋本人のみ。

## リクエスト

パスパラメータ:

| 名前 | 型     | 説明   |
| ---- | ------ | ------ |
| id   | string | 予想ID |

ボディなし。

## レスポンス

`200 OK`

```json
{ "ok": true }
```

## エラー

| HTTP | code            | 条件             |
| ---- | --------------- | ---------------- |
| 401  | `UNAUTHORIZED`  | 未ログイン       |
| 403  | `FORBIDDEN`     | 他人の予想       |
| 403  | `SEASON_CLOSED` | 締切後           |
| 404  | `NOT_FOUND`     | 予想が存在しない |

> チェック順: 存在(404) → 本人(403 FORBIDDEN) → 受付中(403 SEASON_CLOSED)。

## 例

```bash
curl -s -X DELETE http://localhost:8787/api/predictions/<id> -b cookie.txt
```

## 処理仕様

- 受付中のみ取消可。締切後は取り消せない（採点対象の確定性を保つ）。
- 取消は物理削除。締切後の不正投票は削除ではなく採点時に除外する（取消とは別の仕組み）。

## 実装

- [server/src/routes/predictions.ts](../../../server/src/routes/predictions.ts)
- [server/src/repositories/predictions.ts](../../../server/src/repositories/predictions.ts) … `deletePrediction`
