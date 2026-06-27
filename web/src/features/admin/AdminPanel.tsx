import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "../../lib/api";
import type {
  Artist,
  ExternalArtist,
  ExternalTrack,
  Song,
} from "../../lib/types";

function SourceBadge({ source }: { source: ExternalArtist["source"] }) {
  return <span className={`badge badge-${source}`}>{source}</span>;
}

// 外部DB（Spotify→MusicBrainz）からアーティストを検索して登録する
function ArtistRegister() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching, error } = useQuery<ExternalArtist[]>({
    queryKey: ["admin", "external-artists", submitted],
    queryFn: () =>
      apiGet<ExternalArtist[]>(
        `/admin/external/artists?q=${encodeURIComponent(submitted)}`,
      ),
    enabled: submitted.trim().length > 0,
  });

  const register = useMutation({
    mutationFn: (a: ExternalArtist) =>
      apiPost<Artist>("/admin/artists", {
        name: a.name,
        officialUrl: a.url ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artists"] }),
  });

  return (
    <div className="card">
      <h3>アーティストを登録</h3>
      <div className="row">
        <input
          placeholder="アーティスト名で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSubmitted(q)}
        />
        <button onClick={() => setSubmitted(q)}>検索</button>
      </div>
      {isFetching && <p className="muted">検索中…</p>}
      {error instanceof ApiError && <p className="error">{error.message}</p>}
      <ul className="result-list">
        {(data ?? []).map((a) => (
          <li key={`${a.source}:${a.externalId}`}>
            {a.imageUrl && (
              <img className="thumb" src={a.imageUrl} alt="" width={36} height={36} />
            )}
            <span>
              <SourceBadge source={a.source} />
              {" "}
              {a.name}
              {a.detail ? <span className="muted">（{a.detail}）</span> : null}
            </span>
            <button
              className="ghost"
              disabled={register.isPending}
              onClick={() => register.mutate(a)}
            >
              登録
            </button>
          </li>
        ))}
      </ul>
      {register.isSuccess && (
        <p className="muted">「{register.data?.name}」を登録しました。</p>
      )}
      {register.error instanceof ApiError && (
        <p className="error">{register.error.message}</p>
      )}
    </div>
  );
}

// 登録済みアーティストに、外部DBで見つけた曲をひもづけて登録する
function SongRegister() {
  const qc = useQueryClient();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [aq, setAq] = useState("");
  const [tq, setTq] = useState("");
  const [tSubmitted, setTSubmitted] = useState("");

  const { data: artistHits } = useQuery<Artist[]>({
    queryKey: ["artists", "search", aq],
    queryFn: () => apiGet<Artist[]>(`/artists/search?q=${encodeURIComponent(aq)}`),
    enabled: !artist && aq.trim().length > 0,
  });

  const { data: trackHits, isFetching } = useQuery<ExternalTrack[]>({
    queryKey: ["admin", "external-tracks", tSubmitted],
    queryFn: () =>
      apiGet<ExternalTrack[]>(
        `/admin/external/tracks?q=${encodeURIComponent(tSubmitted)}`,
      ),
    enabled: !!artist && tSubmitted.trim().length > 0,
  });

  const register = useMutation({
    mutationFn: (t: ExternalTrack) =>
      apiPost<Song>("/admin/songs", {
        artistId: artist!.id,
        title: t.title,
        releaseYear: t.releaseYear ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artist"] }),
  });

  return (
    <div className="card">
      <h3>曲を登録</h3>
      {!artist ? (
        <>
          <p className="muted">まず登録先のアーティストを選びます（登録済みから）。</p>
          <input
            placeholder="登録済みアーティストを検索"
            value={aq}
            onChange={(e) => setAq(e.target.value)}
          />
          <ul className="result-list">
            {(artistHits ?? []).map((a) => (
              <li key={a.id}>
                <button onClick={() => setArtist(a)}>{a.name}</button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>
            対象: <strong>{artist.name}</strong>{" "}
            <button className="ghost" onClick={() => setArtist(null)}>
              変更
            </button>
          </p>
          <div className="row">
            <input
              placeholder="曲名で検索"
              value={tq}
              onChange={(e) => setTq(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setTSubmitted(tq)}
            />
            <button onClick={() => setTSubmitted(tq)}>検索</button>
          </div>
          {isFetching && <p className="muted">検索中…</p>}
          <ul className="result-list">
            {(trackHits ?? []).map((t) => (
              <li key={`${t.source}:${t.externalId}`}>
                <span>
                  <SourceBadge source={t.source} /> {t.title}
                  <span className="muted">
                    （{t.artistName}
                    {t.releaseYear ? ` / ${t.releaseYear}` : ""}）
                  </span>
                </span>
                <button
                  className="ghost"
                  disabled={register.isPending}
                  onClick={() => register.mutate(t)}
                >
                  登録
                </button>
              </li>
            ))}
          </ul>
          {register.isSuccess && (
            <p className="muted">「{register.data?.title}」を登録しました。</p>
          )}
          {register.error instanceof ApiError && (
            <p className="error">{register.error.message}</p>
          )}
        </>
      )}
    </div>
  );
}

export function AdminPanel() {
  return (
    <section className="panel">
      <h2>管理：アーティスト・曲の登録</h2>
      <p className="muted">
        Spotify を優先し、見つからない場合は MusicBrainz の結果を表示します。
      </p>
      <ArtistRegister />
      <SongRegister />
    </section>
  );
}
