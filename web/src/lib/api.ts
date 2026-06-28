const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function toError(res: Response): Promise<ApiError> {
  let code = "UNKNOWN";
  let message = res.statusText;
  try {
    const body = (await res.json()) as { error?: { code: string; message: string } };
    if (body.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // ignore parse error
  }
  return new ApiError(res.status, code, message);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { credentials: "include" });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  method: "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export const loginUrl = `${BASE}/auth/google/login`;
