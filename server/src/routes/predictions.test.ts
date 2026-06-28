import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import app from "../index";
import { getDb } from "../db";
import { users, artists, seasons, predictions } from "../db/schema";

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

async function seedUser(id: string): Promise<string> {
  await db.insert(users).values({
    id,
    displayName: `user-${id}`,
    email: `${id}@example.com`,
    googleSub: `sub-${id}`,
  });
  return id;
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

beforeEach(async () => {
  // テーブルを綺麗にして各テストを独立させる
  await db.delete(predictions).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
});

describe("POST /api/predictions", () => {
  it("受付中シーズンへ投稿でき、外部アーティストが自動登録される（201）", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);

    const res = await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      confidence: 3,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      userId: string;
      artistId: string;
    };
    expect(body.userId).toBe(userId);
    // 外部選択がローカル artists に1行作られている
    const rows = await db.select().from(artists).all();
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(body.artistId);
  });

  it("未ログインは 401", async () => {
    const res = await post(null, {
      seasonId: "x",
      artist: artistRef("ext-1"),
      confidence: 3,
    });
    expect(res.status).toBe(401);
  });

  it("confidence が範囲外なら 400", async () => {
    const userId = await seedUser("u1");
    const res = await post(await sessionCookie(userId), {
      seasonId: "s1",
      artist: artistRef("ext-1"),
      confidence: 9,
    });
    expect(res.status).toBe(400);
  });

  it("同一の外部アーティストの二重投稿は 409", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);
    const cookie = await sessionCookie(userId);
    const payload = { seasonId, artist: artistRef("ext-1"), confidence: 3 };

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
      confidence: 3,
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
      confidence: 3,
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/predictions/:id", () => {
  it("他人の予想は 403 FORBIDDEN", async () => {
    const owner = await seedUser("owner");
    const other = await seedUser("other");
    const seasonId = await seedSeason("s1", null);

    const created = await post(await sessionCookie(owner), {
      seasonId,
      artist: artistRef("ext-1"),
      confidence: 3,
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(
      `http://localhost/api/predictions/${id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: await sessionCookie(other),
        },
        body: JSON.stringify({ confidence: 5 }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("本人は受付中に編集できる", async () => {
    const owner = await seedUser("owner");
    const seasonId = await seedSeason("s1", null);
    const cookie = await sessionCookie(owner);

    const created = await post(cookie, {
      seasonId,
      artist: artistRef("ext-1"),
      confidence: 3,
    });
    const { id } = (await created.json()) as { id: string };

    const res = await app.request(
      `http://localhost/api/predictions/${id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ confidence: 5, comment: "更新" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { confidence: number }).toMatchObject({
      confidence: 5,
      comment: "更新",
    });
  });
});

describe("GET /api/predictions", () => {
  it("seasonId で絞り込める", async () => {
    const userId = await seedUser("u1");
    const seasonId = await seedSeason("s1", null);
    await post(await sessionCookie(userId), {
      seasonId,
      artist: artistRef("ext-1"),
      confidence: 3,
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
