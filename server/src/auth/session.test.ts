import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { issueSession, requireAuth, SESSION_COOKIE } from "./session";
import type { Bindings, Variables } from "../types/env";

const env = { SESSION_SECRET: "test-secret-please-change" } as Bindings;

const buildApp = () => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  app.get("/issue", async (c) => {
    await issueSession(c, "user-1");
    return c.json({ ok: true });
  });
  app.get("/protected", requireAuth, (c) => c.json({ userId: c.get("userId") }));
  return app;
};

const sessionCookieFrom = (setCookie: string | null): string => {
  if (!setCookie) throw new Error("Set-Cookie がありません");
  const token = setCookie.split(";")[0]?.split("=")[1];
  if (!token) throw new Error("session トークンを取得できません");
  return `${SESSION_COOKIE}=${token}`;
};

describe("セッション往復", () => {
  it("発行したCookieで保護ルートを通過できる", async () => {
    const app = buildApp();

    const issued = await app.request("http://localhost/issue", {}, env);
    const cookie = sessionCookieFrom(issued.headers.get("set-cookie"));

    const res = await app.request(
      "http://localhost/protected",
      { headers: { cookie } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user-1" });
  });

  it("Cookieが無ければ 401", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/protected", {}, env);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "ログインが必要です" },
    });
  });

  it("改ざんされたCookieは 401", async () => {
    const app = buildApp();
    const res = await app.request(
      "http://localhost/protected",
      { headers: { cookie: `${SESSION_COOKIE}=tampered.token.value` } },
      env,
    );
    expect(res.status).toBe(401);
  });
});
