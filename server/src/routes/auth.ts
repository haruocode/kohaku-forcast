import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import {
  buildAuthorizationUrl,
  exchangeCodeForProfile,
} from "../auth/google";
import {
  issueSession,
  clearSession,
  requireAuth,
} from "../auth/session";
import { getDb } from "../db";
import {
  upsertUserByGoogleSub,
  findUserById,
  updateDisplayName,
} from "../repositories/users";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "表示名を入力してください").max(50),
});

const OAUTH_STATE_COOKIE = "oauth_state";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const resolveRedirectUri = (c: { req: { url: string }; env: Bindings }): string =>
  c.env.OAUTH_REDIRECT_URI ??
  new URL(c.req.url).origin + "/api/auth/google/callback";

// Google認可画面へリダイレクト
auth.get("/google/login", (c) => {
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const url = buildAuthorizationUrl({
    clientId: c.env.GOOGLE_CLIENT_ID,
    redirectUri: resolveRedirectUri(c),
    state,
  });
  return c.redirect(url);
});

// Googleからのコールバック
auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });

  if (!code || !state || state !== savedState) {
    return c.json(errorBody("VALIDATION_ERROR", "認証リクエストが不正です"), 400);
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile({
      code,
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: resolveRedirectUri(c),
    });
  } catch {
    return c.json(errorBody("UNAUTHORIZED", "Google認証に失敗しました"), 401);
  }

  const db = getDb(c.env.DB);
  const user = await upsertUserByGoogleSub(db, profile);
  await issueSession(c, user.id);

  return c.redirect(c.env.POST_LOGIN_REDIRECT ?? "/");
});

// ログアウト
auth.post("/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

type MeUser = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

const meResponse = (u: MeUser) => ({
  id: u.id,
  displayName: u.displayName,
  email: u.email,
  avatarUrl: u.avatarUrl,
  isAdmin: u.isAdmin,
});

// 現在のログインユーザー
auth.get("/me", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const user = await findUserById(db, c.get("userId"));
  if (!user) {
    return c.json(errorBody("NOT_FOUND", "ユーザーが見つかりません"), 404);
  }
  return c.json(meResponse(user));
});

// 表示名の変更
auth.patch("/me", requireAuth, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      errorBody("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "入力が不正です"),
      400,
    );
  }
  const db = getDb(c.env.DB);
  const user = await updateDisplayName(db, c.get("userId"), parsed.data.displayName);
  return c.json(meResponse(user));
});

export default auth;
