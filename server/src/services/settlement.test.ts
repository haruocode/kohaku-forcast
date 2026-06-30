import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import app from "../index";
import { getDb } from "../db";
import {
  users,
  artists,
  songs,
  seasons,
  predictions,
  results,
  pointLedger,
} from "../db/schema";

const db = getDb(env.DB);

async function adminCookie(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + 3600 },
    env.SESSION_SECRET,
    "HS256",
  );
  return `session=${token}`;
}

async function balanceOf(userId: string): Promise<number> {
  const row = await db
    .select({ points: users.points })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row!.points;
}

const settle = (seasonId: string, cookie: string) =>
  app.request(
    `http://localhost/api/admin/seasons/${seasonId}/settle`,
    { method: "POST", headers: { cookie } },
    env,
  );

beforeEach(async () => {
  await db.delete(pointLedger).run();
  await db.delete(predictions).run();
  await db.delete(results).run();
  await db.delete(songs).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
});

describe("POST /api/admin/seasons/:id/settle", () => {
  it("締切前は 409", async () => {
    await db.insert(users).values({ id: "admin", displayName: "a", email: "a@e.com", googleSub: "g0", isAdmin: true });
    await db.insert(seasons).values({ id: "s1", year: 2026, predictionCloseAt: null });
    const res = await settle("s1", await adminCookie("admin"));
    expect(res.status).toBe(409);
  });

  it("的中は配当を残高へ加算し、外れは没収のまま（冪等）", async () => {
    await db.insert(users).values([
      { id: "admin", displayName: "a", email: "a@e.com", googleSub: "g0", isAdmin: true, points: 0 },
      // 賭けで残高が引かれた後の状態を模す: 元1000から100ベット済み → 900
      { id: "u1", displayName: "勝ち", email: "u1@e.com", googleSub: "g1", points: 900 },
      { id: "u2", displayName: "負け", email: "u2@e.com", googleSub: "g2", points: 900 },
    ]);
    await db.insert(artists).values([
      { id: "a1", name: "米津玄師" },
      { id: "a2", name: "あいみょん" },
    ]);
    await db.insert(songs).values({ id: "song-1", artistId: "a1", title: "Lemon" });
    await db.insert(seasons).values({
      id: "s1",
      year: 2026,
      predictionOpenAt: "2026-11-01T00:00:00.000Z",
      predictionCloseAt: "2026-12-01T00:00:00.000Z",
    });
    const late = "2026-11-30T23:00:00.000Z";
    await db.insert(predictions).values([
      // u1: a1 出場+曲も的中 → 100×4 = 400 配当
      { id: "p1", userId: "u1", seasonId: "s1", artistId: "a1", songId: "song-1", stake: 100, settled: false, createdAt: late, updatedAt: late },
      // u2: a2 未出場 → 配当0（没収）
      { id: "p2", userId: "u2", seasonId: "s1", artistId: "a2", songId: null, stake: 100, settled: false, createdAt: late, updatedAt: late },
    ]);
    await db.insert(results).values([
      { seasonId: "s1", artistId: "a1", appeared: true, songId: "song-1" },
      { seasonId: "s1", artistId: "a2", appeared: false, songId: null },
    ]);

    const cookie = await adminCookie("admin");
    const res = await settle("s1", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, settledCount: 2, totalPayout: 400 });

    expect(await balanceOf("u1")).toBe(1300); // 900 + 400
    expect(await balanceOf("u2")).toBe(900); // 没収のまま

    // 再実行しても二重精算されない（settled 済みはスキップ）
    const again = await settle("s1", cookie);
    expect(await again.json()).toMatchObject({ settledCount: 0, totalPayout: 0 });
    expect(await balanceOf("u1")).toBe(1300);
  });
});
