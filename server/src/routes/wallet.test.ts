import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import nacl from "tweetnacl";
import bs58 from "bs58";
import app from "../index";
import { getDb } from "../db";
import { users } from "../db/schema";
import { findUserById } from "../repositories/users";

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

async function seedUser(id: string): Promise<string> {
  await db.insert(users).values({
    id,
    displayName: id,
    email: `${id}@example.com`,
    googleSub: `sub-${id}`,
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
  await db.delete(users).run();
});

describe("ウォレット連携", () => {
  it("チャレンジ→署名→連携の正常系", async () => {
    const uid = await seedUser("u1");
    const cookie = await sessionCookie(uid);

    const chRes = await postJson("/api/wallet/challenge", cookie, {});
    expect(chRes.status).toBe(200);
    const { message, challenge } = (await chRes.json()) as {
      message: string;
      challenge: string;
    };

    // ウォレットでメッセージに署名
    const kp = nacl.sign.keyPair();
    const address = bs58.encode(kp.publicKey);
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey),
    );

    const linkRes = await postJson("/api/wallet/link", cookie, {
      address,
      signature,
      challenge,
    });
    expect(linkRes.status).toBe(200);
    expect((await linkRes.json()) as { address: string }).toMatchObject({ address });

    const user = await findUserById(db, uid);
    expect(user?.solanaAddress).toBe(address);
    expect(user?.walletVerifiedAt).toBeTruthy();
  });

  it("未ログインは 401", async () => {
    const res = await postJson("/api/wallet/challenge", null, {});
    expect(res.status).toBe(401);
  });

  it("署名が他人の鍵なら 401", async () => {
    const uid = await seedUser("u1");
    const cookie = await sessionCookie(uid);
    const { message, challenge } = (await (
      await postJson("/api/wallet/challenge", cookie, {})
    ).json()) as { message: string; challenge: string };

    // 署名は別の鍵で作るが、addressは無関係な鍵にする
    const signer = nacl.sign.keyPair();
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), signer.secretKey),
    );
    const otherAddress = bs58.encode(nacl.sign.keyPair().publicKey);

    const res = await postJson("/api/wallet/link", cookie, {
      address: otherAddress,
      signature,
      challenge,
    });
    expect(res.status).toBe(401);
  });

  it("別ユーザーのチャレンジは使えない（400）", async () => {
    const u1 = await seedUser("u1");
    const u2 = await seedUser("u2");
    // u1 がチャレンジを取得
    const { message, challenge } = (await (
      await postJson("/api/wallet/challenge", await sessionCookie(u1), {})
    ).json()) as { message: string; challenge: string };

    const kp = nacl.sign.keyPair();
    const address = bs58.encode(kp.publicKey);
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey),
    );

    // u2 のセッションで u1 のチャレンジを使う
    const res = await postJson("/api/wallet/link", await sessionCookie(u2), {
      address,
      signature,
      challenge,
    });
    expect(res.status).toBe(400);
  });

  it("不正アドレスは 400", async () => {
    const uid = await seedUser("u1");
    const cookie = await sessionCookie(uid);
    const { challenge } = (await (
      await postJson("/api/wallet/challenge", cookie, {})
    ).json()) as { challenge: string };

    const res = await postJson("/api/wallet/link", cookie, {
      address: "not-an-address",
      signature: "x",
      challenge,
    });
    expect(res.status).toBe(400);
  });
});
