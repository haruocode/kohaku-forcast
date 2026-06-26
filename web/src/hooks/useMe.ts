import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "../lib/api";
import type { User } from "../lib/types";

/** 現在のログインユーザー。未ログインなら null */
export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await apiGet<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}
