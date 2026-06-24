import { describe, it, expect } from "vitest";
import { buildAuthorizationUrl, profileFromIdToken } from "./google";

// テスト用の最小id_token（署名は検証しないのでヘッダ/署名はダミー）
const makeIdToken = (claims: Record<string, unknown>): string => {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}.sig`;
};

describe("buildAuthorizationUrl", () => {
  const url = new URL(
    buildAuthorizationUrl({
      clientId: "client-123",
      redirectUri: "http://localhost:5173/api/auth/google/callback",
      state: "state-abc",
    }),
  );

  it("Googleの認可エンドポイントを指す", () => {
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
  });

  it("必須パラメータを含む", () => {
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/google/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});

describe("profileFromIdToken", () => {
  it("クレームから GoogleProfile を取り出す", () => {
    const token = makeIdToken({
      sub: "google-sub-1",
      email: "user@example.com",
      email_verified: true,
      name: "山田太郎",
      picture: "https://example.com/a.png",
    });
    expect(profileFromIdToken(token)).toEqual({
      sub: "google-sub-1",
      email: "user@example.com",
      emailVerified: true,
      name: "山田太郎",
      picture: "https://example.com/a.png",
    });
  });

  it("name/picture が無くても null で埋める", () => {
    const token = makeIdToken({ sub: "s", email: "e@example.com" });
    expect(profileFromIdToken(token)).toMatchObject({
      sub: "s",
      email: "e@example.com",
      emailVerified: false,
      name: null,
      picture: null,
    });
  });

  it("sub / email が無ければ例外", () => {
    const token = makeIdToken({ email: "e@example.com" });
    expect(() => profileFromIdToken(token)).toThrow();
  });
});
