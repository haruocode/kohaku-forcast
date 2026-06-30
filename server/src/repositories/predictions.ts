import { and, eq, desc } from "drizzle-orm";
import type { Db } from "../db";
import { predictions, artists, songs, users, pointLedger } from "../db/schema";
import { InsufficientPointsError } from "./points";

export type Prediction = typeof predictions.$inferSelect;

/** 表示用にアーティスト名・曲名・予想者名を添えた予想 */
export type PredictionDetail = Prediction & {
  artistName: string;
  songTitle: string | null;
  displayName: string;
};

/** 予想の作成に必要な、解決済みのローカル値 */
export type CreatePredictionValues = {
  seasonId: string;
  artistId: string;
  songId: string | null;
  stake: number;
  comment?: string;
};

/** 予想の更新に渡す、解決済みのローカル値（指定された項目のみ反映） */
export type UpdatePredictionValues = {
  songId?: string | null;
  stake?: number;
  comment?: string | null;
};

export async function findPredictionById(
  db: Db,
  id: string,
): Promise<Prediction | undefined> {
  return db.select().from(predictions).where(eq(predictions.id, id)).get();
}

/** 同一ユーザー・同一シーズン・同一アーティストの既存予想を返す（重複チェック用） */
export async function findDuplicate(
  db: Db,
  userId: string,
  seasonId: string,
  artistId: string,
): Promise<Prediction | undefined> {
  return db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.seasonId, seasonId),
        eq(predictions.artistId, artistId),
      ),
    )
    .get();
}

/**
 * 予想を作成し、賭け額を残高から消費する（予想挿入・残高更新・台帳記録を batch で原子的に）。
 * 残高不足なら InsufficientPointsError。
 */
export async function createPredictionWithStake(
  db: Db,
  userId: string,
  input: CreatePredictionValues,
  currentBalance: number,
): Promise<{ prediction: Prediction; balanceAfter: number }> {
  if (currentBalance < input.stake) throw new InsufficientPointsError();
  const balanceAfter = currentBalance - input.stake;
  const predId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db.insert(predictions).values({
      id: predId,
      userId,
      seasonId: input.seasonId,
      artistId: input.artistId,
      songId: input.songId,
      stake: input.stake,
      comment: input.comment ?? null,
    }),
    db
      .update(users)
      .set({ points: balanceAfter, updatedAt: now })
      .where(eq(users.id, userId)),
    db.insert(pointLedger).values({
      userId,
      delta: -input.stake,
      reason: "bet",
      balanceAfter,
      refId: predId,
    }),
  ]);

  const prediction = await findPredictionById(db, predId);
  return { prediction: prediction!, balanceAfter };
}

export async function updatePrediction(
  db: Db,
  id: string,
  patch: UpdatePredictionValues,
): Promise<Prediction> {
  const values: Partial<typeof predictions.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.songId !== undefined) values.songId = patch.songId;
  if (patch.stake !== undefined) values.stake = patch.stake;
  if (patch.comment !== undefined) values.comment = patch.comment;

  return db
    .update(predictions)
    .set(values)
    .where(eq(predictions.id, id))
    .returning()
    .get();
}

export async function deletePrediction(db: Db, id: string): Promise<void> {
  await db.delete(predictions).where(eq(predictions.id, id)).run();
}

/** 精算結果（配当・精算済みフラグ）を記録する */
export async function markSettled(
  db: Db,
  id: string,
  payout: number,
): Promise<void> {
  await db
    .update(predictions)
    .set({ settled: true, payout, updatedAt: new Date().toISOString() })
    .where(eq(predictions.id, id))
    .run();
}

export async function listPredictions(
  db: Db,
  seasonId?: string,
): Promise<Prediction[]> {
  const base = db.select().from(predictions);
  const rows = seasonId
    ? await base.where(eq(predictions.seasonId, seasonId)).orderBy(desc(predictions.createdAt)).all()
    : await base.orderBy(desc(predictions.createdAt)).all();
  return rows;
}

/** 一覧表示用。アーティスト名・曲名・予想者名をJOINして返す。 */
export async function listPredictionsDetailed(
  db: Db,
  seasonId?: string,
): Promise<PredictionDetail[]> {
  const base = db
    .select({
      id: predictions.id,
      userId: predictions.userId,
      seasonId: predictions.seasonId,
      artistId: predictions.artistId,
      songId: predictions.songId,
      confidence: predictions.confidence,
      stake: predictions.stake,
      settled: predictions.settled,
      payout: predictions.payout,
      comment: predictions.comment,
      createdAt: predictions.createdAt,
      updatedAt: predictions.updatedAt,
      artistName: artists.name,
      songTitle: songs.title,
      displayName: users.displayName,
    })
    .from(predictions)
    .innerJoin(artists, eq(predictions.artistId, artists.id))
    .leftJoin(songs, eq(predictions.songId, songs.id))
    .innerJoin(users, eq(predictions.userId, users.id));

  const rows = seasonId
    ? await base.where(eq(predictions.seasonId, seasonId)).orderBy(desc(predictions.createdAt)).all()
    : await base.orderBy(desc(predictions.createdAt)).all();
  return rows;
}
