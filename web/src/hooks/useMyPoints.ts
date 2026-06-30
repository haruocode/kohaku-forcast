import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { MyPoints } from "../lib/types";

/** ログインユーザー自身の通算ポイント・順位。enabled で未ログイン時は取得しない */
export function useMyPoints(enabled: boolean) {
  return useQuery<MyPoints>({
    queryKey: ["my-points"],
    queryFn: () => apiGet<MyPoints>("/rankings/me"),
    enabled,
    staleTime: 60_000,
  });
}
