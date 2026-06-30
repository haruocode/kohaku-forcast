import { eq, desc } from "drizzle-orm";
import type { Db } from "../db";
import { users, pointLedger } from "../db/schema";

export type LedgerReason = "signup" | "daily" | "bet" | "payout" | "refund";
export type LedgerEntry = typeof pointLedger.$inferSelect;

/** 残高不足で消費（ベット）できないときに投げる */
export class InsufficientPointsError extends Error {
  constructor() {
    super("ポイントが不足しています");
    this.name = "InsufficientPointsError";
  }
}

async function readBalance(db: Db, userId: string): Promise<number | undefined> {
  const row = await db
    .select({ points: users.points })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row?.points;
}

/**
 * 残高を delta だけ変動させ、台帳に1行記録する（適用後残高を返す）。
 * 残高更新と台帳挿入は db.batch で原子的に行う。
 * allowNegative=false（既定）で残高が負になる場合は InsufficientPointsError。
 */
export async function applyPointChange(
  db: Db,
  userId: string,
  delta: number,
  reason: LedgerReason,
  opts: {
    refId?: string | null;
    note?: string | null;
    /** 既に残高を読んでいれば渡す（再読込を省く） */
    currentBalance?: number;
    allowNegative?: boolean;
  } = {},
): Promise<number> {
  const current = opts.currentBalance ?? (await readBalance(db, userId));
  if (current === undefined) throw new Error(`user not found: ${userId}`);

  const balanceAfter = current + delta;
  if (!opts.allowNegative && balanceAfter < 0) {
    throw new InsufficientPointsError();
  }

  await db.batch([
    db
      .update(users)
      .set({ points: balanceAfter, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId)),
    db.insert(pointLedger).values({
      userId,
      delta,
      reason,
      balanceAfter,
      refId: opts.refId ?? null,
      note: opts.note ?? null,
    }),
  ]);

  return balanceAfter;
}

/**
 * 日次ログインボーナスを付与する。
 * 同じ日（JSTの YYYY-MM-DD）に既に受け取っていれば付与せず null を返す。
 * 付与した場合は適用後残高を返す。
 */
export async function claimDailyBonus(
  db: Db,
  user: { id: string; points: number; lastDailyBonusDate: string | null },
  jstDate: string,
  amount: number,
): Promise<number | null> {
  if (user.lastDailyBonusDate === jstDate) return null;

  const balanceAfter = user.points + amount;
  await db.batch([
    db
      .update(users)
      .set({
        points: balanceAfter,
        lastDailyBonusDate: jstDate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id)),
    db.insert(pointLedger).values({
      userId: user.id,
      delta: amount,
      reason: "daily",
      balanceAfter,
      note: jstDate,
    }),
  ]);
  return balanceAfter;
}

/** 自分のポイント履歴（新しい順） */
export async function listLedgerForUser(
  db: Db,
  userId: string,
  limit = 100,
): Promise<LedgerEntry[]> {
  return db
    .select()
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId))
    .orderBy(desc(pointLedger.createdAt))
    .limit(limit)
    .all();
}

export type LedgerEntryWithUser = LedgerEntry & {
  displayName: string;
  email: string;
};

/** 全ユーザーのポイント履歴（管理者向け・新しい順）。表示名とメールを添える。 */
export async function listAllLedger(
  db: Db,
  limit = 200,
): Promise<LedgerEntryWithUser[]> {
  return db
    .select({
      id: pointLedger.id,
      userId: pointLedger.userId,
      delta: pointLedger.delta,
      reason: pointLedger.reason,
      balanceAfter: pointLedger.balanceAfter,
      refId: pointLedger.refId,
      note: pointLedger.note,
      createdAt: pointLedger.createdAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(pointLedger)
    .innerJoin(users, eq(pointLedger.userId, users.id))
    .orderBy(desc(pointLedger.createdAt))
    .limit(limit)
    .all();
}
