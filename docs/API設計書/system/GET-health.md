# GET /health

## 概要

ヘルスチェック。死活監視用。`/api` 配下ではない唯一のエンドポイント。

## 認可

公開（認証不要）。

## リクエスト

なし。

## レスポンス

`200 OK`

```json
{ "status": "ok" }
```

## エラー

なし（常に 200）。

## 例

```bash
curl -s http://localhost:8787/health
# {"status":"ok"}
```

## 処理仕様

- 固定レスポンスを返すのみ。DBアクセスや認証は行わない。
- 本番では `/health` は静的アセットより先に Worker が処理する（`wrangler.jsonc` の `run_worker_first`）。

## 実装

- [server/src/index.ts](../../../server/src/index.ts)
