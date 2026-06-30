# POST /api/wallet/challenge

## 概要

ウォレット連携のチャレンジ（署名対象メッセージ＋トークン）を発行する。なりすまし防止の所有確認の第1段階。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

なし。

## レスポンス

`200 OK`

```json
{
  "message": "Kohaku Forecast wallet link\nnonce: <uuid>",
  "challenge": "<JWT>"
}
```

| フィールド | 型     | 説明                                          |
| ---------- | ------ | --------------------------------------------- |
| message    | string | ウォレットで署名してもらう文字列（nonce入り） |
| challenge  | string | 検証時にそのまま送り返すトークン（JWT）       |

## エラー

| HTTP | code           | 条件       |
| ---- | -------------- | ---------- |
| 401  | `UNAUTHORIZED` | 未ログイン |

## 処理仕様

- チャレンジは **ステートレス**（KV/テーブル不要）。`SESSION_SECRET` 署名の JWT に
  `sub=userId` / `nonce` / `kind=wallet-challenge` / 有効期限10分 を載せる。
- `message` は nonce から決定的に生成される。クライアントはこの `message` をそのまま署名する。
- 続けて [POST /api/wallet/link](./POST-link.md) に `challenge` と署名を送る。

## 実装

- [server/src/routes/wallet.ts](../../../server/src/routes/wallet.ts)
- [server/src/auth/wallet-challenge.ts](../../../server/src/auth/wallet-challenge.ts) … `issueWalletChallenge`
- [server/src/domain/wallet.ts](../../../server/src/domain/wallet.ts) … `buildWalletChallengeMessage`
