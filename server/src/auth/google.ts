import { decode } from "hono/jwt";

export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Googleから取得するユーザープロフィール（id_tokenのクレーム） */
export type GoogleProfile = {
  /** 不変のユーザー識別子（OIDCの sub）。users.google_sub に対応 */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/** Google認可エンドポイントへのリダイレクトURLを組み立てる */
export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

type IdTokenClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/** id_token（JWT）のペイロードを GoogleProfile に変換する */
export function profileFromIdToken(idToken: string): GoogleProfile {
  const { payload } = decode(idToken);
  const claims = payload as unknown as IdTokenClaims;
  if (!claims.sub || !claims.email) {
    throw new Error("id_token に sub / email がありません");
  }
  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified ?? false,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
  };
}

/** 認可コードをトークンに交換し、ユーザープロフィールを取得する */
export async function exchangeCodeForProfile(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Googleトークン交換に失敗しました: ${res.status}`);
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("トークン応答に id_token がありません");
  }
  return profileFromIdToken(data.id_token);
}
