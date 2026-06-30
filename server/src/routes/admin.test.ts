import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import app from "../index";
import { getDb } from "../db";
import { users, artists, seasons, results } from "../db/schema";
import { findResult } from "../repositories/results";

const db = getDb(env.DB);

async function sessionCookie(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + 3600 },
    env.SESSION_SECRET,
    "HS256",
  );
  return `session=${token}`;
}

async function seedUser(id: string, isAdmin: boolean): Promise<string> {
  await db.insert(users).values({
    id,
    displayName: id,
    email: `${id}@example.com`,
    googleSub: `sub-${id}`,
    isAdmin,
  });
  return id;
}

const postJson = (path: string, cookie: string | null, body: unknown) =>
  app.request(
    `http://localhost${path}`,
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
  await db.delete(results).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();
  await db.insert(seasons).values({ id: "s1", year: 2026, predictionCloseAt: null });
  await db.insert(artists).values([
    { id: "a1", name: "アーティスト1" },
    { id: "a2", name: "アーティスト2" },
  ]);
});

describe("管理APIのアクセス制御", () => {
  it("未ログインは 401", async () => {
    const res = await postJson("/api/admin/results", null, {
      seasonId: "s1",
      entries: [{ artistId: "a1", appeared: true }],
    });
    expect(res.status).toBe(401);
  });

  it("非管理者は 403", async () => {
    const uid = await seedUser("u1", false);
    const res = await postJson("/api/admin/results", await sessionCookie(uid), {
      seasonId: "s1",
      entries: [{ artistId: "a1", appeared: true }],
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/seasons/:id/close", () => {
  it("公式発表の日時を締切に設定する（過去日時も可）", async () => {
    const uid = await seedUser("admin", true);
    const res = await postJson(
      "/api/admin/seasons/s1/close",
      await sessionCookie(uid),
      { announcedAt: "2026-12-31T21:00:00.000Z" },
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { predictionCloseAt: string }).toMatchObject({
      predictionCloseAt: "2026-12-31T21:00:00.000Z",
    });
  });

  it("不正な日時は 400", async () => {
    const uid = await seedUser("admin", true);
    const res = await postJson(
      "/api/admin/seasons/s1/close",
      await sessionCookie(uid),
      { announcedAt: "not-a-date" },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/results", () => {
  it("結果をupsertし、再送で更新される（冪等）", async () => {
    const uid = await seedUser("admin", true);
    const cookie = await sessionCookie(uid);

    const first = await postJson("/api/admin/results", cookie, {
      seasonId: "s1",
      entries: [
        { artistId: "a1", appeared: true, songId: null },
        { artistId: "a2", appeared: false },
      ],
    });
    expect(first.status).toBe(200);
    expect((await first.json()) as { count: number }).toMatchObject({ count: 2 });

    // a1 を出場→未出場に更新
    await postJson("/api/admin/results", cookie, {
      seasonId: "s1",
      entries: [{ artistId: "a1", appeared: false }],
    });

    const r = await findResult(db, "s1", "a1");
    expect(r?.appeared).toBe(false);

    // 1行に保たれている（重複しない）
    const all = await db.select().from(results).all();
    expect(all.length).toBe(2);
  });

  it("appeared=false なら songId は強制的に NULL", async () => {
    const uid = await seedUser("admin", true);
    await postJson("/api/admin/results", await sessionCookie(uid), {
      seasonId: "s1",
      entries: [{ artistId: "a1", appeared: false, songId: "should-be-ignored" }],
    });
    const r = await findResult(db, "s1", "a1");
    expect(r?.songId).toBeNull();
  });
});

describe("管理作成API", () => {
  it("シーズン・アーティスト（別名）・曲を作成できる", async () => {
    const uid = await seedUser("admin", true);
    const cookie = await sessionCookie(uid);

    const season = await postJson("/api/admin/seasons", cookie, { year: 2027 });
    expect(season.status).toBe(201);

    const artistRes = await postJson("/api/admin/artists", cookie, {
      name: "米津玄師",
      nameKana: "よねづけんし",
      aliases: ["ハチ", "Kenshi Yonezu"],
    });
    expect(artistRes.status).toBe(201);
    const artist = (await artistRes.json()) as { id: string };

    const songRes = await postJson("/api/admin/songs", cookie, {
      artistId: artist.id,
      title: "Lemon",
      titleKana: "れもん",
    });
    expect(songRes.status).toBe(201);

    // 別名検索でヒットする
    const search = await app.request(
      "http://localhost/api/artists/search?q=kenshi",
      {},
      env,
    );
    expect(((await search.json()) as unknown[]).length).toBe(1);
  });

  it("曲作成で存在しないアーティストは 404", async () => {
    const uid = await seedUser("admin", true);
    const res = await postJson("/api/admin/songs", await sessionCookie(uid), {
      artistId: "missing",
      title: "X",
    });
    expect(res.status).toBe(404);
  });

  it("非管理者は作成できない（403）", async () => {
    const uid = await seedUser("u1", false);
    const res = await postJson("/api/admin/seasons", await sessionCookie(uid), {
      year: 2027,
    });
    expect(res.status).toBe(403);
  });
});
