import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import { tokenAwards } from "../db/schema";

export type TokenAward = typeof tokenAwards.$inferSelect;

export async function findAward(
  db: Db,
  userId: string,
  seasonId: string,
): Promise<TokenAward | undefined> {
  return db
    .select()
    .from(tokenAwards)
    .where(and(eq(tokenAwards.userId, userId), eq(tokenAwards.seasonId, seasonId)))
    .get();
}

/**
 * 配布レコードを pending で用意する（(user, season) で冪等）。
 * 既存が sent でない場合のみ amount/address を更新して pending に戻す。
 */
export async function upsertPendingAward(
  db: Db,
  input: { userId: string; seasonId: string; amount: number; solanaAddress: string },
): Promise<TokenAward> {
  const nowIso = new Date().toISOString();
  return db
    .insert(tokenAwards)
    .values({
      userId: input.userId,
      seasonId: input.seasonId,
      amount: input.amount,
      solanaAddress: input.solanaAddress,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [tokenAwards.userId, tokenAwards.seasonId],
      set: {
        amount: input.amount,
        solanaAddress: input.solanaAddress,
        status: "pending",
        updatedAt: nowIso,
      },
    })
    .returning()
    .get();
}

export async function markAwardSent(
  db: Db,
  id: string,
  txSignature: string,
): Promise<void> {
  await db
    .update(tokenAwards)
    .set({ status: "sent", txSignature, updatedAt: new Date().toISOString() })
    .where(eq(tokenAwards.id, id))
    .run();
}

export async function markAwardFailed(db: Db, id: string): Promise<void> {
  await db
    .update(tokenAwards)
    .set({ status: "failed", updatedAt: new Date().toISOString() })
    .where(eq(tokenAwards.id, id))
    .run();
}

export async function listAwardsBySeason(
  db: Db,
  seasonId: string,
): Promise<TokenAward[]> {
  return db.select().from(tokenAwards).where(eq(tokenAwards.seasonId, seasonId)).all();
}
