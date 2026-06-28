import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../hooks/useMe";
import { apiPost, loginUrl } from "../lib/api";

export function AuthBar() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();

  const logout = async () => {
    await apiPost("/auth/logout");
    // ユーザー依存のキャッシュを捨ててから、me を即 null にして画面を確実に切り替える
    // （再フェッチ任せにせず、タイミング依存をなくす）。
    qc.clear();
    qc.setQueryData(["me"], null);
  };

  return (
    <header className="authbar">
      <span className="brand">紅白出場者予想アプリ</span>
      {isLoading ? (
        <span className="muted">…</span>
      ) : me ? (
        <span className="authbar-right">
          {me.avatarUrl && <img className="avatar" src={me.avatarUrl} alt="" />}
          <span>{me.displayName}</span>
          <button onClick={logout}>ログアウト</button>
        </span>
      ) : (
        <a className="btn" href={loginUrl}>
          Googleでログイン
        </a>
      )}
    </header>
  );
}
