import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

export const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30日

type Env = { Bindings: Bindings; Variables: Variables };

const isSecure = (c: Context<Env>): boolean =>
  new URL(c.req.url).protocol === "https:";

/** ユーザーIDを署名付きJWTにしてセッションCookieへ保存する */
export async function issueSession(c: Context<Env>, userId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS },
    c.env.SESSION_SECRET,
  );
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** セッションCookieを破棄する */
export function clearSession(c: Context<Env>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** セッションCookieを検証し、有効ならユーザーIDを返す（無効なら null） */
export async function readSession(c: Context<Env>): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const payload = await verify(token, c.env.SESSION_SECRET, "HS256");
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** 認証必須ルート用ミドルウェア。未ログインは 401 を返す */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const userId = await readSession(c);
  if (!userId) {
    return c.json(errorBody("UNAUTHORIZED", "ログインが必要です"), 401);
  }
  c.set("userId", userId);
  await next();
};
