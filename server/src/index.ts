import { Hono } from "hono";
import authRoutes from "./routes/auth";
import predictionRoutes from "./routes/predictions";
import artistRoutes from "./routes/artists";
import songRoutes from "./routes/songs";
import adminRoutes from "./routes/admin";
import rankingRoutes from "./routes/rankings";
import pointRoutes from "./routes/points";
import seasonRoutes from "./routes/seasons";
import type { Bindings, Variables } from "./types/env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/predictions", predictionRoutes);
app.route("/api/artists", artistRoutes);
app.route("/api/songs", songRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/rankings", rankingRoutes);
app.route("/api/points", pointRoutes);
app.route("/api/seasons", seasonRoutes);

export default app;
