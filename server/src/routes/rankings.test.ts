import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import app from "../index";
import { getDb } from "../db";
import { users, artists, songs, seasons, predictions, results } from "../db/schema";

const db = getDb(env.DB);

beforeEach(async () => {
  await db.delete(predictions).run();
  await db.delete(results).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
});

const get = (path: string) => app.request(`http://localhost${path}`, {}, env);

describe("GET /api/rankings/:seasonId", () => {
  it("締切前は 409", async () => {
    await db.insert(seasons).values({ id: "s1", year: 2026, predictionCloseAt: null });
    const res = await get("/api/rankings/s1");
    expect(res.status).toBe(409);
  });

  it("存在しないシーズンは 404", async () => {
    expect((await get("/api/rankings/none")).status).toBe(404);
  });

  it("確定後はスコア順にランキングを返す", async () => {
    await db.insert(users).values([
      { id: "u1", displayName: "ヨネヅ予想", email: "u1@e.com", googleSub: "g1" },
      { id: "u2", displayName: "出場のみ", email: "u2@e.com", googleSub: "g2" },
    ]);
    await db.insert(artists).values({ id: "a1", name: "米津玄師" });
    await db.insert(songs).values({ id: "song-1", artistId: "a1", title: "Lemon" });
    await db.insert(seasons).values({
      id: "s1",
      year: 2026,
      predictionOpenAt: "2026-11-01T00:00:00.000Z",
      predictionCloseAt: "2026-12-01T00:00:00.000Z",
    });
    // 締切間際に投稿（早押しの影響を排除）
    const late = "2026-11-30T23:00:00.000Z";
    await db.insert(predictions).values([
      {
        id: "p1",
        userId: "u1",
        seasonId: "s1",
        artistId: "a1",
        songId: "song-1",
        confidence: 5,
        createdAt: late,
        updatedAt: late,
      },
      {
        id: "p2",
        userId: "u2",
        seasonId: "s1",
        artistId: "a1",
        songId: null,
        confidence: 3,
        createdAt: late,
        updatedAt: late,
      },
    ]);
    // a1 は出場し song-1 を歌った
    await db.insert(results).values({
      seasonId: "s1",
      artistId: "a1",
      appeared: true,
      songId: "song-1",
    });

    const res = await get("/api/rankings/s1");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as {
      rank: number;
      userId: string;
      displayName: string;
      score: number;
      hitCount: number;
    }[];

    expect(rows[0]).toMatchObject({ rank: 1, userId: "u1", score: 30, hitCount: 1 });
    expect(rows[1]).toMatchObject({ rank: 2, userId: "u2", score: 10, hitCount: 1 });
    expect(rows[0]!.displayName).toBe("ヨネヅ予想");
  });
});
