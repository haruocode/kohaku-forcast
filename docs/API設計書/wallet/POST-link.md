# POST /api/wallet/link

## 概要

ウォレットの署名を検証し、Solanaアドレスをユーザーに連携する。所有確認の第2段階。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

ボディ（JSON）。Zod `linkWalletSchema`。

| フィールド | 型     | 必須 | 説明                                                             |
| ---------- | ------ | ---- | ---------------------------------------------------------------- |
| address    | string | 必須 | base58 の Solana 公開鍵（32バイト）                              |
| signature  | string | 必須 | base58 の ed25519 署名（64バイト）                               |
| challenge  | string | 必須 | [POST /api/wallet/challenge](./POST-challenge.md) で得たトークン |

```json
{ "address": "<base58>", "signature": "<base58>", "challenge": "<JWT>" }
```

## レスポンス

`200 OK`

```json
{ "address": "<base58>", "walletVerifiedAt": "2026-..." }
```

副作用: `users.solana_address` と `users.wallet_verified_at` を設定する。

## エラー

| HTTP | code               | 条件                                                                   |
| ---- | ------------------ | ---------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致 / アドレス不正 / チャレンジが無効・期限切れ・本人不一致 |
| 401  | `UNAUTHORIZED`     | 署名の検証に失敗（鍵とメッセージが一致しない）                         |

## 処理仕様

1. スキーマ検証（必須項目）。
2. `isValidSolanaAddress` でアドレス形式を確認（base58 → 32バイト）。
3. `verifyWalletChallenge` で `challenge` を検証し、署名対象の `message` を復元
   （`kind`/`sub(userId)`/期限を確認。不正は 400）。
4. `verifyWalletSignature` で `address` が `message` に対する `signature` を正しく署名しているか
   ed25519 検証（不一致は 401）。
5. 検証成功で `setWalletAddress`。

## 実装

- [server/src/routes/wallet.ts](../../../server/src/routes/wallet.ts)
- [server/src/schemas/wallet.ts](../../../server/src/schemas/wallet.ts)
- [server/src/domain/wallet.ts](../../../server/src/domain/wallet.ts) … `isValidSolanaAddress`, `verifyWalletSignature`
- [server/src/auth/wallet-challenge.ts](../../../server/src/auth/wallet-challenge.ts) … `verifyWalletChallenge`
- [server/src/repositories/users.ts](../../../server/src/repositories/users.ts) … `setWalletAddress`
