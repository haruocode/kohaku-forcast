import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import { listLedgerForUser } from "../repositories/points";
import type { Bindings, Variables } from "../types/env";

const points = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 自分のポイント履歴（付与・消費・配当・返金の明細。新しい順）。
points.get("/history", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const rows = await listLedgerForUser(db, c.get("userId"));
  return c.json(rows);
});

export default points;
