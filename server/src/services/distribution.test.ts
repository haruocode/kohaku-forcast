import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { getDb } from "../db";
import { users, artists, songs, seasons, predictions, results } from "../db/schema";
import { distributeSeasonTokens } from "./distribution";
import { listAwardsBySeason } from "../repositories/tokenAwards";
import { findSeasonById } from "../repositories/seasons";
import type { Minter } from "../token/minter";

const db = getDb(env.DB);

// 呼び出しを記録するモック送信器。failFor のアドレスは失敗させる。
function fakeMinter(failFor?: string) {
  const calls: { address: string; amount: number }[] = [];
  const minter: Minter = {
    async mintTo(address, amount) {
      calls.push({ address, amount });
      if (address === failFor) throw new Error("mint failed");
      return `sig-${address}`;
    },
  };
  return { minter, calls };
}

const late = "2026-11-30T23:00:00.000Z";

beforeEach(async () => {
  await db.delete(predictions).run();
  await db.delete(results).run();
  await db.delete(songs).run();
  await db.delete(seasons).run();
  await db.delete(artists).run();
  await db.delete(users).run();

  await db.insert(users).values([
    { id: "u1", displayName: "u1", email: "u1@e.com", googleSub: "g1", solanaAddress: "WALLET_U1" },
    { id: "u2", displayName: "u2", email: "u2@e.com", googleSub: "g2" }, // ウォレット未連携
  ]);
  await db.insert(artists).values({ id: "a1", name: "米津玄師" });
  await db.insert(songs).values({ id: "s1", artistId: "a1", title: "Lemon" });
  await db.insert(seasons).values({
    id: "season-1",
    year: 2026,
    predictionOpenAt: "2026-11-01T00:00:00.000Z",
    predictionCloseAt: "2026-12-01T00:00:00.000Z",
  });
  // 両者とも a1 を両的中（=スコア30）。投稿は締切間際で早押し影響なし。
  await db.insert(predictions).values([
    { id: "p1", userId: "u1", seasonId: "season-1", artistId: "a1", songId: "s1", confidence: 5, createdAt: late, updatedAt: late },
    { id: "p2", userId: "u2", seasonId: "season-1", artistId: "a1", songId: "s1", confidence: 5, createdAt: late, updatedAt: late },
  ]);
  await db.insert(results).values({ seasonId: "season-1", artistId: "a1", appeared: true, songId: "s1" });
});

const season = () => findSeasonById(db, "season-1").then((s) => s!);

describe("distributeSeasonTokens", () => {
  it("ウォレット連携者へ配布し、未連携はスキップ", async () => {
    const { minter, calls } = fakeMinter();
    const summary = await distributeSeasonTokens(db, await season(), minter);

    expect(summary).toMatchObject({ total: 2, sent: 1, skipped: 1, failed: 0 });
    expect(calls).toEqual([{ address: "WALLET_U1", amount: 30 }]);

    const awards = await listAwardsBySeason(db, "season-1");
    expect(awards.length).toBe(1);
    expect(awards[0]).toMatchObject({
      userId: "u1",
      amount: 30,
      status: "sent",
      txSignature: "sig-WALLET_U1",
    });
  });

  it("再実行しても二重配布しない（冪等）", async () => {
    const first = fakeMinter();
    await distributeSeasonTokens(db, await season(), first.minter);

    const second = fakeMinter();
    const summary = await distributeSeasonTokens(db, await season(), second.minter);

    expect(summary).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(second.calls).toEqual([]); // 2回目は mint しない
  });

  it("送信失敗は failed で記録し、再実行で再試行できる", async () => {
    const fail = fakeMinter("WALLET_U1");
    const s1 = await distributeSeasonTokens(db, await season(), fail.minter);
    expect(s1).toMatchObject({ failed: 1, sent: 0 });
    expect((await listAwardsBySeason(db, "season-1"))[0]?.status).toBe("failed");

    // 復旧後の再実行で sent になる
    const ok = fakeMinter();
    const s2 = await distributeSeasonTokens(db, await season(), ok.minter);
    expect(s2).toMatchObject({ sent: 1 });
    expect((await listAwardsBySeason(db, "season-1"))[0]?.status).toBe("sent");
  });
});
