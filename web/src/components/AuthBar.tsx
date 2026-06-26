import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../hooks/useMe";
import { apiPost, loginUrl } from "../lib/api";

export function AuthBar() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();

  const logout = async () => {
    await apiPost("/auth/logout");
    qc.clear();
  };

  return (
    <header className="authbar">
      <span className="brand">紅白予想</span>
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
