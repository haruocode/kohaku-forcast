import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { users } from "../db/schema";
import type { GoogleProfile } from "../auth/google";

export type User = typeof users.$inferSelect;

/** id でユーザーを取得する */
export async function findUserById(db: Db, id: string): Promise<User | undefined> {
  return db.select().from(users).where(eq(users.id, id)).get();
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
