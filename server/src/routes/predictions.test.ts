import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import app from "../index";
import { getDb } from "../db";
import { users, artists, seasons, predictions, pointLedger } from "../db/schema";

const db = getDb(env.DB);

// ログイン済みユーザーのセッションCookieを生成する
async function sessionCookie(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + 3600 },
    env.SESSION_SECRET,
    "HS256",
  );
  return `session=${token}`;
}

async function seedUser(id: string, points = 1000): Promise<string> {
  await db.insert(users).values({
    id,
    displayName: `user-${id}`,
    email: `${id}@example.com`,
    googleSub: `sub-${id}`,
    points,
  });
  return id;
}

async function balanceOf(userId: string): Promise<number> {
  const row = await db
    .select({ points: users.points })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row!.points;
}

// 外部選択（Spotify）を模した予想ボディ用のアーティスト参照
const artistRef = (externalId: string) => ({
  source: "spotify" as const,
  externalId,
  name: `artist-${externalId}`,
});

async function seedSeason(id: string, closeAt: string | null): Promise<string> {
  await db.insert(seasons).values({
    id,
    year: Math.floor(Math.random() * 100000),
    predictionCloseAt: closeAt,
  });
  return id;
}

const post = (cookie: string | null, body: unknown) =>
  app.request(
    "http://localhost/api/predictions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    env,
  );

const put = (id: string, cookie: string, body: unknown) =>
  app.request(
    `http://localhost/api/predictions/${id}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    },
    env,
  );

beforeEach(async () => {
  // テーブルを綺麗にして各テストを独立させる
  await db.delete(pointLedger).run();
  await db.delete(predictions).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
});

describe("POST /api/predictions", () => {
  it("受付中シーズンへ投稿でき、賭け額が残高から引かれる（201）", async () => {
    const userId = await seedUser("u1", 1000);
    const seasonId = await seedSeason("s1", null);

    const res = await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      userId: string;
      artistId: string;
      stake: number;
      balanceAfter: number;
    };
    expect(body.userId).toBe(userId);
    expect(body.stake).toBe(100);
    expect(body.balanceAfter).toBe(900);
    expect(await balanceOf(userId)).toBe(900);
    // 外部選択がローカル artists に1行作られている
    const rows = await db.select().from(artists).all();
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(body.artistId);
    // 台帳に bet 行が残る
    const ledger = await db.select().from(pointLedger).all();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ delta: -100, reason: "bet", balanceAfter: 900 });
  });

  it("未ログインは 401", async () => {
    const res = await post(null, {
      seasonId: "x",
      artist: artistRef("ext-1"),
      stake: 100,
    });
    expect(res.status).toBe(401);
  });

  it("賭け額が最低額未満なら 400", async () => {
    const userId = await seedUser("u1");
    const res = await post(await sessionCookie(userId), {
      seasonId: "s1",
      artist: artistRef("ext-1"),
      stake: 5,
    });
    expect(res.status).toBe(400);
  });

  it("残高不足は 400 INSUFFICIENT_POINTS（予想は作られない）", async () => {
    const userId = await seedUser("u1", 50);
    const seasonId = await seedSeason("s1", null);
    const res = await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "INSUFFICIENT_POINTS" },
    });
    expect(await balanceOf(userId)).toBe(50);
    expect((await db.select().from(predictions).all()).length).toBe(0);
  });

  it("同一の外部アーティストの二重投稿は 409", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);
    const cookie = await sessionCookie(userId);
    const payload = { seasonId, artist: artistRef("ext-1"), stake: 100 };

    expect((await post(cookie, payload)).status).toBe(201);
    expect((await post(cookie, payload)).status).toBe(409);
    // 二重投稿でもアーティスト行は1つに集約される
    expect((await db.select().from(artists).all()).length).toBe(1);
  });

  it("締切済みシーズンへの投稿は 403 SEASON_CLOSED", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", "2020-01-01T00:00:00.000Z");

    const res = await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });
    expect(res.status).toBe(403);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "SEASON_CLOSED" },
    });
  });

  it("artist が欠けていれば 400", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);
    const res = await post(await sessionCookie(userId), {
      seasonId,
      stake: 100,
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/predictions/:id", () => {
  it("他人の予想は 403 FORBIDDEN", async () => {
    const owner = await seedUser("owner");
    await seedUser("other");
    const seasonId = await seedSeason("s1", null);

    const created = await post(await sessionCookie(owner), {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });
    const { id } = (await created.json()) as { id: string };

    const res = await put(id, await sessionCookie("other"), { stake: 200 });
    expect(res.status).toBe(403);
  });

  it("本人は受付中に賭け額を変更でき、差分が残高に反映される", async () => {
    const owner = await seedUser("owner", 1000);
    const seasonId = await seedSeason("s1", null);
    const cookie = await sessionCookie(owner);

    const created = await post(cookie, {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });
    const { id } = (await created.json()) as { id: string };
    expect(await balanceOf(owner)).toBe(900);

    // 100 → 250 に増額（差分 -150）
    const res = await put(id, cookie, { stake: 250, comment: "更新" });
    expect(res.status).toBe(200);
    expect((await res.json()) as { stake: number; comment: string }).toMatchObject({
      stake: 250,
      comment: "更新",
    });
    expect(await balanceOf(owner)).toBe(750);
  });
});

describe("DELETE /api/predictions/:id", () => {
  it("取消で賭け額が返金される", async () => {
    const owner = await seedUser("owner", 1000);
    const seasonId = await seedSeason("s1", null);
    const cookie = await sessionCookie(owner);

    const created = await post(cookie, {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });
    const { id } = (await created.json()) as { id: string };
    expect(await balanceOf(owner)).toBe(900);

    const res = await app.request(
      `http://localhost/api/predictions/${id}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { balanceAfter: number }).toMatchObject({
      balanceAfter: 1000,
    });
    expect(await balanceOf(owner)).toBe(1000);
  });
});

describe("GET /api/predictions", () => {
  it("seasonId で絞り込める", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);
    await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      stake: 100,
    });

    const res = await app.request(
      `http://localhost/api/predictions?seasonId=${seasonId}`,
      {},
      env,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBe(1);
  });
});
