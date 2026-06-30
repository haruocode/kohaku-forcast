# GET /api/wallet/awards

## 概要

ログインユーザーが獲得した記念トークンの一覧を返す（シーズン年付き・新しい年から）。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

なし。

## レスポンス

`200 OK` … 配布記録の配列。

```json
[
  {
    "id": "uuid",
    "seasonId": "uuid",
    "seasonYear": 2026,
    "amount": 45,
    "status": "sent",
    "txSignature": "<base58>"
  }
]
```

| フィールド  | 型                              | 説明                                   |
| ----------- | ------------------------------- | -------------------------------------- |
| seasonYear  | number                          | シーズンの年度                         |
| amount      | number                          | 配布枚数（＝そのシーズンの合計スコア） |
| status      | "pending" \| "sent" \| "failed" | 送信状態                               |
| txSignature | string \| null                  | Solana トランザクション署名（sent 時） |

## エラー

| HTTP | code           | 条件       |
| ---- | -------------- | ---------- |
| 401  | `UNAUTHORIZED` | 未ログイン |

## 例

```bash
curl -s http://localhost:8787/api/wallet/awards -b cookie.txt
```

## 処理仕様

- `token_awards` と `seasons` を JOIN し、自分（`userId`）の行のみ返す。
- フロントは `txSignature` があれば Solana Explorer（devnet）の tx リンクを表示する。
- 配布の実行は管理者の [POST /api/admin/seasons/:id/distribute](../admin/POST-seasons-id-distribute.md)。

## 実装

- [server/src/routes/wallet.ts](../../../server/src/routes/wallet.ts)
- [server/src/repositories/tokenAwards.ts](../../../server/src/repositories/tokenAwards.ts) … `listAwardsByUser`
