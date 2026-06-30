# POST /api/admin/seasons/:id/distribute

## 概要

記念トークンを配布する。結果確定後・締切済みのシーズンに対し、合計スコアに比例した枚数を
ウォレット連携済みユーザーへ mint する。冪等。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

パスパラメータ:

| 名前 | 型     | 説明       |
| ---- | ------ | ---------- |
| id   | string | シーズンID |

ボディなし。

## レスポンス

`200 OK` … 配布サマリ。

```json
{ "total": 5, "sent": 3, "failed": 0, "skipped": 1, "alreadySent": 1 }
```

| フィールド  | 型     | 説明                               |
| ----------- | ------ | ---------------------------------- |
| total       | number | 配布対象（スコア>0）の人数         |
| sent        | number | 今回送信成功した人数               |
| failed      | number | 送信失敗（再試行可能）の人数       |
| skipped     | number | ウォレット未連携でスキップした人数 |
| alreadySent | number | 既に送信済みで再配布しなかった人数 |

## エラー

| HTTP | code             | 条件                                        |
| ---- | ---------------- | ------------------------------------------- |
| 403  | `FORBIDDEN`      | 非管理者                                    |
| 404  | `NOT_FOUND`      | シーズンが存在しない                        |
| 409  | `CONFLICT`       | 締切前（`prediction_close_at` が NULL）     |
| 501  | `NOT_CONFIGURED` | RPC/mint/鍵 が未設定（`SOLANA_RPC_URL` 等） |

## 処理仕様（冪等性）

1. シーズン存在＆締切確認。
2. `createMinterFromEnv` で minter を構築（環境未設定なら 501）。
3. `computeAwards` で配布量を算出（量＝合計スコアの整数。スコア0以下は対象外）。
4. 各対象について:
   - ウォレット未連携 → `skipped`。
   - 既存 award が `sent` → `alreadySent`（再 mint しない）。
   - それ以外 → `upsertPendingAward`（(user, season) 一意で pending 用意）→ `mintTo` →
     成功で `markAwardSent`（`sent`）/ 失敗で `markAwardFailed`（`failed`）。

- 再実行しても `sent` 済みは二重配布されない。`failed` は再実行で再試行できる。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/services/distribution.ts](../../../server/src/services/distribution.ts) … `distributeSeasonTokens`
- [server/src/domain/distribution.ts](../../../server/src/domain/distribution.ts) … `computeAwards`
- [server/src/token/minter-factory.ts](../../../server/src/token/minter-factory.ts) … `createMinterFromEnv`
- [server/src/repositories/tokenAwards.ts](../../../server/src/repositories/tokenAwards.ts)
