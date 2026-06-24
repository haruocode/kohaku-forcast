// 一貫したエラーレスポンス形式（AGENTS.md「エラーレスポンス形式」）。
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SEASON_CLOSED"
  | "INTERNAL";

export const errorBody = (code: ErrorCode, message: string) => ({
  error: { code, message },
});
