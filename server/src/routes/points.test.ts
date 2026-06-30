import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import app from "../index";
import { getDb } from "../db";
import { users, pointLedger } from "../db/schema";
import { DAILY_BONUS } from "../config/points";

const db = getDb(env.DB);

async function cookie(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + 3600 },
    env.SESSION_SECRET,
    "HS256",
  );
  return `session=${token}`;
}

async function seedUser(id: string, points = 500): Promise<void> {
  await db.insert(users).values({
    id,
    displayName: id,
    email: `${id}@e.com`,
    googleSub: `g-${id}`,
    points,
  });
}

const getMe = (c: string) =>
  app.request("http://localhost/api/auth/me", { headers: { cookie: c } }, env);

beforeEach(async () => {
  await db.delete(pointLedger).run();
  await db.delete(users).run();
});

describe("日次ログインボーナス（/api/auth/me）", () => {
  it("当日1回だけ付与される", async () => {
    await seedUser("u1", 500);
    const c = await cookie("u1");

    const first = (await (await getMe(c)).json()) as { points: number };
    expect(first.points).toBe(500 + DAILY_BONUS);

    // 同日2回目は加算されない
    const second = (await (await getMe(c)).json()) as { points: number };
    expect(second.points).toBe(500 + DAILY_BONUS);

    // 台帳には daily が1行だけ
    const daily = (await db.select().from(pointLedger).all()).filter(
      (r) => r.reason === "daily",
    );
    expect(daily).toHaveLength(1);
  });
});

describe("GET /api/points/history", () => {
  it("未ログインは 401", async () => {
    expect(
      (await app.request("http://localhost/api/points/history", {}, env)).status,
    ).toBe(401);
  });

  it("自分の履歴を新しい順で返す", async () => {
    await seedUser("u1", 500);
    await db.insert(pointLedger).values([
      { userId: "u1", delta: 1000, reason: "signup", balanceAfter: 1000, createdAt: "2026-01-01T00:00:00.000Z" },
      { userId: "u1", delta: -100, reason: "bet", balanceAfter: 900, createdAt: "2026-01-02T00:00:00.000Z" },
    ]);
    const res = await app.request(
      "http://localhost/api/points/history",
      { headers: { cookie: await cookie("u1") } },
      env,
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { reason: string }[];
    expect(rows.map((r) => r.reason)).toEqual(["bet", "signup"]);
  });
});
