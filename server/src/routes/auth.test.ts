import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import app from "../index";
import { getDb } from "../db";
import { users } from "../db/schema";
import {
  upsertUserByGoogleSub,
  updateDisplayName,
  findUserById,
} from "../repositories/users";
import type { GoogleProfile } from "../auth/google";

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

async function seedUser(id: string, displayName = `user-${id}`): Promise<string> {
  await db.insert(users).values({
    id,
    displayName,
    email: `${id}@example.com`,
    googleSub: `sub-${id}`,
  });
  return id;
}

const patchMe = (cookie: string | null, body: unknown) =>
  app.request(
    "http://localhost/api/auth/me",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    env,
  );

beforeEach(async () => {
  await db.delete(users).run();
});

describe("PATCH /api/auth/me", () => {
  it("表示名を変更できる（前後の空白はトリムされる）", async () => {
    const id = await seedUser("u1");
    const res = await patchMe(await sessionCookie(id), { displayName: "  新しい名前  " });
    expect(res.status).toBe(200);
    expect((await res.json()) as { displayName: string }).toMatchObject({
      displayName: "新しい名前",
    });
    expect((await findUserById(db, id))?.displayName).toBe("新しい名前");
  });

  it("未ログインは 401", async () => {
    const res = await patchMe(null, { displayName: "x" });
    expect(res.status).toBe(401);
  });

  it("空（空白のみ）の表示名は 400", async () => {
    const id = await seedUser("u1");
    const res = await patchMe(await sessionCookie(id), { displayName: "   " });
    expect(res.status).toBe(400);
  });
});

describe("upsertUserByGoogleSub", () => {
  it("再ログインしても、変更後の表示名を Google 名で上書きしない", async () => {
    const profile: GoogleProfile = {
      sub: "g-1",
      email: "a@example.com",
      emailVerified: true,
      name: "Google Name",
      picture: null,
    };
    const created = await upsertUserByGoogleSub(db, profile);
    expect(created.displayName).toBe("Google Name"); // 初回は Google 名

    await updateDisplayName(db, created.id, "カスタム名");
    const again = await upsertUserByGoogleSub(db, profile); // 再ログイン相当
    expect(again.displayName).toBe("カスタム名");
  });
});
