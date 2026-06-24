import { Hono } from "hono";
import type { Bindings } from "./types/env";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.json({ ok: true, service: "kohaku-forcast" }));

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
