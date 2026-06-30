import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "../../lib/api";
import type { RankingRow, Season } from "../../lib/types";

type Scope = "season" | "overall";

export function RankingsPanel() {
  const [scope, setScope] = useState<Scope>("season");

  const { data: season } = useQuery<Season>({
    queryKey: ["season", "current"],
    queryFn: () => apiGet<Season>("/seasons/current"),
  });

  const seasonQuery = useQuery<RankingRow[]>({
    queryKey: ["rankings", "season", season?.id],
    queryFn: () => apiGet<RankingRow[]>(`/rankings/${season!.id}`),
    enabled: scope === "season" && !!season,
  });

  const overallQuery = useQuery<RankingRow[]>({
    queryKey: ["rankings", "overall"],
    queryFn: () => apiGet<RankingRow[]>("/rankings/overall"),
    enabled: scope === "overall",
  });

  const active = scope === "season" ? seasonQuery : overallQuery;

  const body = () => {
    if (scope === "season" && !season) {
      return <p className="muted">シーズンがありません。</p>;
    }
    if (active.isLoading) {
      return <p className="muted">集計中…</p>;
    }
    if (
      scope === "season" &&
      active.error instanceof ApiError &&
      active.error.code === "CONFLICT"
    ) {
      return <p className="muted">結果確定後に表示されます（締切前）。</p>;
    }
    const rows = active.data ?? [];
    if (rows.length === 0) {
      return <p className="muted">まだランキングはありません。</p>;
    }
    const isSeason = scope === "season";
    return (
      <table className="ranking">
        <thead>
          <tr>
            <th>順位</th>
            <th>ユーザー</th>
            <th>{isSeason ? "損益" : "所持ポイント"}</th>
            {isSeason && <th>的中</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId}>
              <td>{r.rank}</td>
              <td>{r.displayName}</td>
              <td>
                {isSeason && r.score > 0 ? "+" : ""}
                {r.score}
                {isSeason ? "" : " pt"}
              </td>
              {isSeason && <td>{r.hitCount ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <section className="panel">
      <h2>ランキング</h2>
      <nav className="subtabs">
        <button
          className={scope === "season" ? "active" : ""}
          onClick={() => setScope("season")}
        >
          今シーズン
        </button>
        <button
          className={scope === "overall" ? "active" : ""}
          onClick={() => setScope("overall")}
        >
          通算
        </button>
      </nav>
      {body()}
    </section>
  );
}
