import { Hono } from "hono";
import authRoutes from "./routes/auth";
import predictionRoutes from "./routes/predictions";
import type { Bindings, Variables } from "./types/env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/predictions", predictionRoutes);

export default app;
