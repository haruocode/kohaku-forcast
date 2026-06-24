import { sign, verify } from "hono/jwt";
import { buildWalletChallengeMessage } from "../domain/wallet";

// ウォレット連携のチャレンジは、サーバー署名のJWTに nonce を載せた
// ステートレス方式（KV/テーブル不要）。

const CHALLENGE_TTL_SECONDS = 600; // 10分
const KIND = "wallet-challenge";

export type WalletChallenge = {
  /** 署名してもらうメッセージ（クライアントはこれをそのまま署名する） */
  message: string;
  /** 検証時にそのまま送り返してもらうトークン */
  challenge: string;
};

/** ユーザー向けにチャレンジ（メッセージ＋トークン）を発行する */
export async function issueWalletChallenge(
  userId: string,
  secret: string,
): Promise<WalletChallenge> {
  const nonce = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const challenge = await sign(
    { sub: userId, nonce, kind: KIND, iat: now, exp: now + CHALLENGE_TTL_SECONDS },
    secret,
  );
  return { message: buildWalletChallengeMessage(nonce), challenge };
}

/**
 * チャレンジトークンを検証し、署名対象だったメッセージを復元する。
 * userId が一致しない・種別違い・期限切れは null。
 */
export async function verifyWalletChallenge(
  challenge: string,
  userId: string,
  secret: string,
): Promise<{ message: string } | null> {
  try {
    const payload = await verify(challenge, secret, "HS256");
    if (payload.kind !== KIND) return null;
    if (payload.sub !== userId) return null;
    if (typeof payload.nonce !== "string") return null;
    return { message: buildWalletChallengeMessage(payload.nonce) };
  } catch {
    return null;
  }
}
