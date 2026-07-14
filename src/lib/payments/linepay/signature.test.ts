import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signLinePayRequest } from "./signature";

describe("signLinePayRequest", () => {
  it("matches the documented HMAC-SHA256(channelSecret + apiPath + body + nonce) → base64 algorithm", () => {
    const channelSecret = "test-channel-secret";
    const apiPath = "/v3/payments/request";
    const body = JSON.stringify({ amount: 100, currency: "TWD", orderId: "order-1" });
    const nonce = "fixed-nonce-for-test";

    const expected = createHmac("sha256", channelSecret)
      .update(channelSecret + apiPath + body + nonce, "utf8")
      .digest("base64");

    expect(signLinePayRequest({ channelSecret, apiPath, body, nonce })).toBe(expected);
  });

  it("produces a base64-encoded 32-byte SHA-256 digest", () => {
    const signature = signLinePayRequest({
      channelSecret: "secret",
      apiPath: "/v3/payments/request",
      body: "{}",
      nonce: "abc",
    });
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(signature, "base64")).toHaveLength(32);
  });

  it("changes when channelSecret, apiPath, body, or nonce changes", () => {
    const base = {
      channelSecret: "secret",
      apiPath: "/v3/payments/request",
      body: "{}",
      nonce: "n1",
    };
    const baseline = signLinePayRequest(base);

    expect(signLinePayRequest({ ...base, nonce: "n2" })).not.toBe(baseline);
    expect(signLinePayRequest({ ...base, body: '{"a":1}' })).not.toBe(baseline);
    expect(signLinePayRequest({ ...base, apiPath: "/v3/payments/999/confirm" })).not.toBe(baseline);
    expect(signLinePayRequest({ ...base, channelSecret: "other-secret" })).not.toBe(baseline);
  });

  it("signs GET requests (empty body) correctly", () => {
    const channelSecret = "secret";
    const apiPath = "/v3/payments/preapprovedPay/regKey123/check";
    const nonce = "nonce-get";

    const expected = createHmac("sha256", channelSecret)
      .update(channelSecret + apiPath + "" + nonce, "utf8")
      .digest("base64");

    expect(signLinePayRequest({ channelSecret, apiPath, body: "", nonce })).toBe(expected);
  });
});
