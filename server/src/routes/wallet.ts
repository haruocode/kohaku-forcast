import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import {
  issueWalletChallenge,
  verifyWalletChallenge,
} from "../auth/wallet-challenge";
import { isValidSolanaAddress, verifyWalletSignature } from "../domain/wallet";
import { setWalletAddress } from "../repositories/users";
import { listAwardsByUser } from "../repositories/tokenAwards";
import { linkWalletSchema } from "../schemas/wallet";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const wallet = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 連携チャレンジを発行する（署名対象メッセージ＋トークン）
wallet.post("/challenge", requireAuth, async (c) => {
  const challenge = await issueWalletChallenge(c.get("userId"), c.env.SESSION_SECRET);
  return c.json(challenge);
});

// 自分の獲得した記念トークン一覧
wallet.get("/awards", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const awards = await listAwardsByUser(db, c.get("userId"));
  return c.json(awards);
});

// 署名を検証してウォレットを連携する
wallet.post("/link", requireAuth, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = linkWalletSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力が不正です";
    return c.json(errorBody("VALIDATION_ERROR", msg), 400);
  }
  const { address, signature, challenge } = parsed.data;

  if (!isValidSolanaAddress(address)) {
    return c.json(errorBody("VALIDATION_ERROR", "Solanaアドレスが不正です"), 400);
  }

  const userId = c.get("userId");
  const verified = await verifyWalletChallenge(challenge, userId, c.env.SESSION_SECRET);
  if (!verified) {
    return c.json(errorBody("VALIDATION_ERROR", "チャレンジが無効か期限切れです"), 400);
  }

  if (!verifyWalletSignature(address, verified.message, signature)) {
    return c.json(errorBody("UNAUTHORIZED", "署名の検証に失敗しました"), 401);
  }

  const db = getDb(c.env.DB);
  const user = await setWalletAddress(db, userId, address);
  return c.json({ address: user.solanaAddress, walletVerifiedAt: user.walletVerifiedAt });
});

export default wallet;
