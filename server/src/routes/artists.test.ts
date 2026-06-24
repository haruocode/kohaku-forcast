import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import app from "../index";
import { getDb } from "../db";
import { artists, artistAliases, songs } from "../db/schema";

const db = getDb(env.DB);

beforeEach(async () => {
  await db.delete(songs).run();
  await db.delete(artistAliases).run();
  await db.delete(artists).run();

  await db.insert(artists).values([
    { id: "a-yonezu", name: "米津玄師", nameKana: "よねづけんし" },
    { id: "a-aimyon", name: "あいみょん", nameKana: "あいみょん" },
  ]);
  await db.insert(artistAliases).values([
    { artistId: "a-yonezu", alias: "ハチ" },
    { artistId: "a-yonezu", alias: "Kenshi Yonezu" },
  ]);
  await db.insert(songs).values([
    { id: "s-lemon", artistId: "a-yonezu", title: "Lemon", titleKana: "れもん" },
  ]);
});

const get = (path: string) =>
  app.request(`http://localhost${path}`, {}, env);

describe("GET /api/artists/search", () => {
  it("漢字の部分一致", async () => {
    const res = await get("/api/artists/search?q=米津");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["a-yonezu"]);
  });

  it("カタカナ入力でひらがなのkanaにヒット", async () => {
    const res = await get(`/api/artists/search?q=${encodeURIComponent("ヨネヅ")}`);
    const rows = (await res.json()) as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["a-yonezu"]);
  });

  it("別名（英語）でヒット", async () => {
    const res = await get("/api/artists/search?q=kenshi");
    const rows = (await res.json()) as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["a-yonezu"]);
  });

  it("q が無ければ 400", async () => {
    expect((await get("/api/artists/search")).status).toBe(400);
  });

  it("ヒットなしは空配列", async () => {
    const res = await get("/api/artists/search?q=宇多田");
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /api/artists/:id/songs", () => {
  it("アーティストの曲一覧を返す", async () => {
    const res = await get("/api/artists/a-yonezu/songs");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { title: string }[];
    expect(rows.map((r) => r.title)).toEqual(["Lemon"]);
  });

  it("存在しないアーティストは 404", async () => {
    expect((await get("/api/artists/missing/songs")).status).toBe(404);
  });
});

describe("GET /api/songs/search", () => {
  it("かな違いでヒット", async () => {
    const res = await get(`/api/songs/search?q=${encodeURIComponent("レモン")}`);
    const rows = (await res.json()) as { id: string; artistName: string }[];
    expect(rows.map((r) => r.id)).toEqual(["s-lemon"]);
    expect(rows[0]?.artistName).toBe("米津玄師");
  });
});
