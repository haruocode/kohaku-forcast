import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import app from "../index";
import { getDb } from "../db";
import {
  users,
  artists,
  songs,
  seasons,
  predictions,
  pointLedger,
} from "../db/schema";

const db = getDb(env.DB);

beforeEach(async () => {
  await db.delete(pointLedger).run();
  await db.delete(predictions).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
});

const get = (path: string) => app.request(`http://localhost${path}`, {}, env);

async function sessionCookie(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + 3600 },
    env.SESSION_SECRET,
    "HS256",
  );
  return `session=${token}`;
}

const getAuthed = (path: string, cookie: string) =>
  app.request(`http://localhost${path}`, { headers: { cookie } }, env);

describe("GET /api/rankings/overall", () => {
  it("所持ポイント残高の多い順に返す", async () => {
    await db.insert(users).values([
      { id: "u1", displayName: "富豪", email: "u1@e.com", googleSub: "g1", points: 1500 },
      { id: "u2", displayName: "並", email: "u2@e.com", googleSub: "g2", points: 800 },
      { id: "u3", displayName: "並", email: "u3@e.com", googleSub: "g3", points: 800 },
    ]);

    const res = await get("/api/rankings/overall");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as {
      rank: number;
      userId: string;
      score: number;
    }[];
    expect(rows[0]).toMatchObject({ rank: 1, userId: "u1", score: 1500 });
    // 同値は同順位（競技順位法）
    expect(rows[1]).toMatchObject({ rank: 2, score: 800 });
    expect(rows[2]).toMatchObject({ rank: 2, score: 800 });
  });
});

describe("GET /api/rankings/me", () => {
  it("未ログインは 401", async () => {
    expect((await get("/api/rankings/me")).status).toBe(401);
  });

  it("自分の残高と順位を返す", async () => {
    await db.insert(users).values([
      { id: "u1", displayName: "富豪", email: "u1@e.com", googleSub: "g1", points: 1500 },
      { id: "u2", displayName: "自分", email: "u2@e.com", googleSub: "g2", points: 800 },
    ]);
    const res = await getAuthed("/api/rankings/me", await sessionCookie("u2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ score: 800, rank: 2, totalUsers: 2 });
  });
});

describe("GET /api/rankings/:seasonId", () => {
  it("締切前は 409", async () => {
    await db.insert(seasons).values({ id: "s1", year: 2026, predictionCloseAt: null });
    const res = await get("/api/rankings/s1");
    expect(res.status).toBe(409);
  });

  it("存在しないシーズンは 404", async () => {
    expect((await get("/api/rankings/none")).status).toBe(404);
  });

  it("精算済みの純損益（配当-賭け額）順に返す", async () => {
    await db.insert(users).values([
      { id: "u1", displayName: "勝ち", email: "u1@e.com", googleSub: "g1" },
      { id: "u2", displayName: "負け", email: "u2@e.com", googleSub: "g2" },
    ]);
    await db.insert(artists).values([
      { id: "a1", name: "米津玄師" },
      { id: "a2", name: "あいみょん" },
    ]);
    await db.insert(seasons).values({
      id: "s1",
      year: 2026,
      predictionOpenAt: "2026-11-01T00:00:00.000Z",
      predictionCloseAt: "2026-12-01T00:00:00.000Z",
    });
    const late = "2026-11-30T23:00:00.000Z";
    // u1: 100賭けて配当200（profit +100）。u2: 100賭けて外れ payout0（profit -100）。
    await db.insert(predictions).values([
      { id: "p1", userId: "u1", seasonId: "s1", artistId: "a1", songId: null, stake: 100, settled: true, payout: 200, createdAt: late, updatedAt: late },
      { id: "p2", userId: "u2", seasonId: "s1", artistId: "a2", songId: null, stake: 100, settled: true, payout: 0, createdAt: late, updatedAt: late },
    ]);

    const res = await get("/api/rankings/s1");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as {
      rank: number;
      userId: string;
      score: number;
      hitCount: number;
    }[];
    expect(rows[0]).toMatchObject({ rank: 1, userId: "u1", score: 100, hitCount: 1 });
    expect(rows[1]).toMatchObject({ rank: 2, userId: "u2", score: -100, hitCount: 0 });
  });
});
