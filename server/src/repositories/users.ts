import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { users, pointLedger } from "../db/schema";
import type { GoogleProfile } from "../auth/google";
import { INITIAL_GRANT } from "../config/points";

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

/** 表示名を変更する */
export async function updateDisplayName(
  db: Db,
  userId: string,
  displayName: string,
): Promise<User> {
  const nowIso = new Date().toISOString();
  return db
    .update(users)
    .set({ displayName, updatedAt: nowIso })
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
    // 表示名はユーザーが変更できるため、再ログイン時に Google 名で上書きしない。
    // （初回作成時のみ Google 名を採用する。）
    const updated = await db
      .update(users)
      .set({
        email: profile.email,
        avatarUrl: profile.picture ?? existing.avatarUrl,
        updatedAt: nowIso,
      })
      .where(eq(users.id, existing.id))
      .returning()
      .get();
    return updated;
  }

  // 新規登録は初期ポイントを付与し、台帳に signup として残す（残高更新と記録を原子的に）。
  const userId = crypto.randomUUID();
  await db.batch([
    db.insert(users).values({
      id: userId,
      displayName: profile.name ?? profile.email,
      email: profile.email,
      googleSub: profile.sub,
      avatarUrl: profile.picture,
      points: INITIAL_GRANT,
    }),
    db.insert(pointLedger).values({
      userId,
      delta: INITIAL_GRANT,
      reason: "signup",
      balanceAfter: INITIAL_GRANT,
      note: "初回登録ボーナス",
    }),
  ]);
  const created = await findUserById(db, userId);
  return created!;
}
