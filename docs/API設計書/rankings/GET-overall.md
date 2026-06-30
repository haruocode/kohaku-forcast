# GET /api/rankings/overall

## 概要

通算ランキングを返す。結果確定済み（締切済み）の**全シーズンのスコアを合算**したサイト内ポイントの総合順位。

## 認可

公開（認証不要）。

## リクエスト

なし（パス・クエリ・ボディなし）。

> 注意: ルート登録順で `/overall` は `/:seasonId` より**先**に定義する
> （`overall` がパスパラメータに食われないように）。

## レスポンス

`200 OK` … ランキング行の配列（順位順）。形は
[GET /api/rankings/:seasonId](./GET-seasonId.md) と同じ。

```json
[
  { "rank": 1, "userId": "uuid", "displayName": "常連", "score": 40, "hitCount": 2 },
  { "rank": 2, "userId": "uuid", "displayName": "新顔", "score": 10, "hitCount": 1 }
]
```

| フィールド | 型 | 説明 |
|---|---|---|
| rank | number | 通算順位（同点同順位＝競技順位法） |
| score | number | 通算ポイント（全締切済みシーズンの合計。**負もあり得る**。四捨五入した整数） |
| hitCount | number | 通算の的中件数 |

- 締切済みシーズンが1件も無ければ `[]`（空配列）を返す。

## エラー

なし（常に 200）。シーズン未確定でも空配列を返す。

## 処理仕様

1. 全シーズンから `prediction_close_at !== null`（締切済み）を抽出。
2. 各シーズンについてシーズン版と同じ採点（早押し・不正投票除外を含む）で `RankEntry[]` を算出。
3. `combineRankings` でユーザー単位に合算：
   - 通算スコア = 各シーズン `totalScore` の合計（**マイナスも許容／floorしない**）。
   - 的中件数 = 各シーズン `hitCount` の合計。
   - タイブレーク用 `earliestAt` = 全シーズンを通じた最初の予想投稿時刻。
4. 並び順はシーズン版と同じ（スコア降順 → 的中件数降順 → 投稿の早さ）。
- ポイント専用テーブルは持たず**都度算出**する（紅白は年1回でデータ件数が小さい前提）。

## 実装

- [server/src/routes/rankings.ts](../../../server/src/routes/rankings.ts) … `rankSeason`, `withDisplayNames`
- [server/src/domain/ranking.ts](../../../server/src/domain/ranking.ts) … `combineRankings`
- [server/src/repositories/seasons.ts](../../../server/src/repositories/seasons.ts) … `listSeasons`
