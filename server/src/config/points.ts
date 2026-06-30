// ポイント経済のパラメータ（プロダクト設定）。調整はここを変える。

/** 初回登録時に付与する初期ポイント */
export const INITIAL_GRANT = 1000;
/** 日次ログインボーナス（1日1回） */
export const DAILY_BONUS = 100;
/** 1予想あたりの最低ベット額 */
export const MIN_BET = 10;

/** JST（UTC+9）での YYYY-MM-DD を返す。日次ボーナスの「1日」境界に使う。 */
export function jstDate(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
