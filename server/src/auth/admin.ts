import type { MiddlewareHandler } from "hono";
import { readSession } from "./session";
import { getDb } from "../db";
import { findUserById } from "../repositories/users";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

type Env = { Bindings: Bindings; Variables: Variables };

/** 管理者専用ルート用ミドルウェア。未ログインは 401、非管理者は 403 */
export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
  const userId = await readSession(c);
  if (!userId) {
    return c.json(errorBody("UNAUTHORIZED", "ログインが必要です"), 401);
  }
  const user = await findUserById(getDb(c.env.DB), userId);
  if (!user || !user.isAdmin) {
    return c.json(errorBody("FORBIDDEN", "管理者権限が必要です"), 403);
  }
  c.set("userId", userId);
  await next();
};
