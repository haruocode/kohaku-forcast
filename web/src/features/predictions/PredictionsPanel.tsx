import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiSend, ApiError } from "../../lib/api";
import type {
  ExternalArtist,
  ExternalTrack,
  Prediction,
  Season,
  User,
} from "../../lib/types";

function useSeason() {
  return useQuery<Season>({
    queryKey: ["season", "current"],
    queryFn: () => apiGet<Season>("/seasons/current"),
  });
}

function ArtistSearch({ onPick }: { onPick: (a: ExternalArtist) => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery<ExternalArtist[]>({
    queryKey: ["artists", "external", q],
    queryFn: () =>
      apiGet<ExternalArtist[]>(`/artists/external?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  return (
    <div>
      <input
        placeholder="アーティスト名で検索（Spotify / MusicBrainz）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isFetching && <span className="muted"> 検索中…</span>}
      <ul className="result-list">
        {(data ?? []).map((a) => (
          <li key={`${a.source}:${a.externalId}`}>
            <button onClick={() => onPick(a)}>
              {a.name}
              {a.detail ? <span className="muted">（{a.detail}）</span> : null}
              <span className="muted"> · {a.source}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SongSearch({
  artist,
  selected,
  onSelect,
}: {
  artist: ExternalArtist;
  selected: ExternalTrack | null;
  onSelect: (t: ExternalTrack | null) => void;
}) {
  const [q, setQ] = useState(artist.name);
  const { data, isFetching } = useQuery<ExternalTrack[]>({
    queryKey: ["songs", "external", q],
    queryFn: () =>
      apiGet<ExternalTrack[]>(`/songs/external?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  if (selected) {
    return (
      <div className="row">
        <span>
          🎵 {selected.title}
          {selected.releaseYear ? (
            <span className="muted">（{selected.releaseYear}）</span>
          ) : null}
        </span>
        <button className="ghost" onClick={() => onSelect(null)}>
          曲を変える
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        placeholder="曲名で検索（任意・出場予想のみも可）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isFetching && <span className="muted"> 検索中…</span>}
      <ul className="result-list">
        {(data ?? []).map((t) => (
          <li key={`${t.source}:${t.externalId}`}>
            <button onClick={() => onSelect(t)}>
              {t.title}
              <span className="muted">
                {" "}
                · {t.artistName}
                {t.releaseYear ? `（${t.releaseYear}）` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PredictionForm({
  season,
  artist,
  onDone,
}: {
  season: Season;
  artist: ExternalArtist;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [song, setSong] = useState<ExternalTrack | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [comment, setComment] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiPost<Prediction>("/predictions", {
        seasonId: season.id,
        artist,
        song,
        confidence,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      onDone();
    },
  });

  return (
    <div className="card">
      <h3>{artist.name} を予想</h3>
      <label>
        歌う曲（任意・出場予想のみも可）
        <SongSearch artist={artist} selected={song} onSelect={setSong} />
      </label>
      <label>
        確信度: {confidence}
        <input
          type="range"
          min={1}
          max={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
      </label>
      <label>
        コメント
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="row">
        <button disabled={create.isPending} onClick={() => create.mutate()}>
          予想する
        </button>
        <button className="ghost" onClick={onDone}>
          やめる
        </button>
      </div>
      {create.error instanceof ApiError && (
        <p className="error">{create.error.message}</p>
      )}
    </div>
  );
}

function PredictionList({ season, me }: { season: Season; me: User | null }) {
  const qc = useQueryClient();
  const { data } = useQuery<Prediction[]>({
    queryKey: ["predictions", season.id],
    queryFn: () => apiGet<Prediction[]>(`/predictions?seasonId=${season.id}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean }>("DELETE", `/predictions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["predictions"] }),
  });

  return (
    <div>
      <h3>みんなの予想</h3>
      <ul className="result-list">
        {(data ?? []).map((p) => (
          <li key={p.id}>
            <span>
              artist:{p.artistId.slice(0, 6)} / 確信度{p.confidence}
              {p.comment ? ` / ${p.comment}` : ""}
            </span>
            {me && me.id === p.userId && season.isOpen && (
              <button className="ghost" onClick={() => remove.mutate(p.id)}>
                取消
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PredictionsPanel({ me }: { me: User | null }) {
  const { data: season, isLoading, error } = useSeason();
  const [artist, setArtist] = useState<ExternalArtist | null>(null);

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (error || !season)
    return <p className="muted">シーズンがまだありません（管理者の設定待ち）。</p>;

  return (
    <section className="panel">
      <h2>
        予想（{season.year}）{season.isOpen ? "" : "｜受付終了"}
      </h2>
      {!me ? (
        <p className="muted">予想するにはログインしてください。</p>
      ) : !season.isOpen ? (
        <p className="muted">この回の受付は終了しています。</p>
      ) : artist ? (
        <PredictionForm season={season} artist={artist} onDone={() => setArtist(null)} />
      ) : (
        <ArtistSearch onPick={setArtist} />
      )}
      <PredictionList season={season} me={me} />
    </section>
  );
}
