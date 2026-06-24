import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { users } from "../db/schema";
import type { GoogleProfile } from "../auth/google";

export type User = typeof users.$inferSelect;

/** id でユーザーを取得する */
export async function findUserById(db: Db, id: string): Promise<User | undefined> {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** 複数idのユーザーをまとめて取得する */
export async function findUsersByIds(db: Db, ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids)).all();
}

/** ウォレットアドレスを設定する（所有確認済みの時刻も記録） */
export async function setWalletAddress(
  db: Db,
  userId: string,
  address: string,
): Promise<User> {
  const nowIso = new Date().toISOString();
  return db
    .update(users)
    .set({ solanaAddress: address, walletVerifiedAt: nowIso, updatedAt: nowIso })
    .where(eq(users.id, userId))
    .returning()
    .get();
}

/**
 * google_sub でユーザーを照合し、無ければ作成する（あれば最新プロフィールに更新）。
 * 同一ユーザーの識別はメールではなく google_sub を正とする。
 */
export async function upsertUserByGoogleSub(
  db: Db,
  profile: GoogleProfile,
): Promise<User> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, profile.sub))
    .get();

  const nowIso = new Date().toISOString();

  if (existing) {
    const updated = await db
      .update(users)
      .set({
        email: profile.email,
        displayName: profile.name ?? existing.displayName,
        avatarUrl: profile.picture ?? existing.avatarUrl,
        updatedAt: nowIso,
      })
      .where(eq(users.id, existing.id))
      .returning()
      .get();
    return updated;
  }

  const created = await db
    .insert(users)
    .values({
      displayName: profile.name ?? profile.email,
      email: profile.email,
      googleSub: profile.sub,
      avatarUrl: profile.picture,
    })
    .returning()
    .get();
  return created;
}
