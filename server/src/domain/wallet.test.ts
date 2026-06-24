import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  isValidSolanaAddress,
  buildWalletChallengeMessage,
  verifyWalletSignature,
} from "./wallet";

// テスト用にキーペアを生成し、メッセージへ署名する
function signWith(message: string) {
  const kp = nacl.sign.keyPair();
  const address = bs58.encode(kp.publicKey);
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return { address, signature: bs58.encode(sig) };
}

describe("isValidSolanaAddress", () => {
  it("正しい公開鍵は true", () => {
    const address = bs58.encode(nacl.sign.keyPair().publicKey);
    expect(isValidSolanaAddress(address)).toBe(true);
  });
  it("短すぎる/不正な文字列は false", () => {
    expect(isValidSolanaAddress("not-an-address")).toBe(false);
    expect(isValidSolanaAddress("")).toBe(false);
  });
});

describe("verifyWalletSignature", () => {
  const message = buildWalletChallengeMessage("nonce-123");

  it("正しい署名は検証成功", () => {
    const { address, signature } = signWith(message);
    expect(verifyWalletSignature(address, message, signature)).toBe(true);
  });

  it("メッセージが違えば失敗", () => {
    const { address, signature } = signWith(message);
    expect(
      verifyWalletSignature(address, buildWalletChallengeMessage("other"), signature),
    ).toBe(false);
  });

  it("別アドレスでは失敗", () => {
    const { signature } = signWith(message);
    const otherAddress = bs58.encode(nacl.sign.keyPair().publicKey);
    expect(verifyWalletSignature(otherAddress, message, signature)).toBe(false);
  });

  it("不正なbase58は false", () => {
    expect(verifyWalletSignature("xxx", message, "yyy")).toBe(false);
  });
});
