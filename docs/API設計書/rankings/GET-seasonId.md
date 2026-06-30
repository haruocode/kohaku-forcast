# GET /api/rankings/:seasonId

## 概要

シーズンのランキングを返す。締切後のみ。予想×結果からスコアを算出して順位付けする。

## 認可

公開（認証不要）。

## リクエスト

パスパラメータ:

| 名前     | 型     | 説明       |
| -------- | ------ | ---------- |
| seasonId | string | シーズンID |

## レスポンス

`200 OK` … ランキング行の配列（順位順）。

```json
[
  {
    "rank": 1,
    "userId": "uuid",
    "displayName": "ユーザーA",
    "score": 45,
    "hitCount": 2
  },
  {
    "rank": 2,
    "userId": "uuid",
    "displayName": "ユーザーB",
    "score": 30,
    "hitCount": 1
  }
]
```

| フィールド  | 型     | 説明                                     |
| ----------- | ------ | ---------------------------------------- |
| rank        | number | 順位（同点同順位＝競技順位法）           |
| userId      | string | ユーザーID                               |
| displayName | string | 表示名（取得不可なら `(unknown)`）       |
| score       | number | 合計スコア（内部小数を四捨五入した整数） |
| hitCount    | number | スコアが付いた（正の点の）予想件数       |

## エラー

| HTTP | code        | 条件                                                        |
| ---- | ----------- | ----------------------------------------------------------- |
| 404  | `NOT_FOUND` | シーズンが存在しない                                        |
| 409  | `CONFLICT`  | 締切前（`prediction_close_at` が NULL）＝まだ確定していない |

## 例

```bash
curl -s http://localhost:8787/api/rankings/<seasonId>
```

## 処理仕様（採点・並び順）

1. 締切確認（NULL なら 409）。
2. 予想・結果を取得し、結果を `Map<artistId, {appeared, actualSongId}>` に整形。
3. 早押しウィンドウ = `{ openAt: predictionOpenAt ?? predictionCloseAt, closeAt: predictionCloseAt }`。
   `openAt` 未設定なら span<=0 となり早押しボーナスは無効（倍率1.0）。
4. `computeRanking` で集計:
   - **基礎点**: 出場的中 +10、曲も一致 +20（合算）、未出場 -10。
   - **早押し**: 正の基礎点に `×(1 + 0.5×早さ)`。早さは `updated_at` 基準。
   - **不正投票**: `updated_at >= closeAt` は採点対象外（0点）。
   - **並び順**: 合計スコア降順 → 的中件数降順 → 最初の投稿が早い順。スコア・的中件数が同じなら同順位。
5. ユーザー表示名を引いて整形。`score` は `displayScore`（四捨五入）。

詳細なスコア表は [API設計書「ドメインロジック」](../API設計書.md#4-ドメインロジック仕様) を参照。

## 実装

- [server/src/routes/rankings.ts](../../../server/src/routes/rankings.ts)
- [server/src/domain/ranking.ts](../../../server/src/domain/ranking.ts) … `computeRanking`
- [server/src/domain/scoring.ts](../../../server/src/domain/scoring.ts) … 採点ロジック
