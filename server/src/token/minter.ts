// 記念トークンの送信器。テストではモックを差し込み、本番では SolanaMinter を使う。
export interface Minter {
  /** address（base58）へ amount 枚 mint し、トランザクション署名を返す */
  mintTo(address: string, amount: number): Promise<string>;
}
