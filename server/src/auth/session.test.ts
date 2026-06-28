import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { clearSession, issueSession, requireAuth, SESSION_COOKIE } from "./session";
import type { Bindings, Variables } from "../types/env";

const env = { SESSION_SECRET: "test-secret-please-change" } as Bindings;

const buildApp = () => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  app.get("/issue", async (c) => {
    await issueSession(c, "user-1");
    return c.json({ ok: true });
  });
  app.get("/protected", requireAuth, (c) => c.json({ userId: c.get("userId") }));
  app.post("/logout", (c) => {
    clearSession(c);
    return c.json({ ok: true });
  });
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

  it("ログアウトはCookieを失効させ、その後は保護ルートが 401", async () => {
    const app = buildApp();

    // https では Secure 付きで発行・失効する（発行時と属性を揃えないと消えない）
    const out = await app.request("https://example.com/logout", { method: "POST" }, env);
    const setCookie = out.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
    expect(setCookie).toMatch(/Secure/i);

    // 失効後のCookie（空値）では保護ルートを通れない
    const res = await app.request(
      "http://localhost/protected",
      { headers: { cookie: `${SESSION_COOKIE}=` } },
      env,
    );
    expect(res.status).toBe(401);
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
