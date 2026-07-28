import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
} from "./security";

describe("security helpers", () => {
  it("normalizes email without changing the domain semantics", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("hashes and verifies passwords without storing the plaintext", async () => {
    const encoded = await hashPassword("a-long-password-123");
    expect(encoded).not.toContain("a-long-password-123");
    expect(await verifyPassword("a-long-password-123", encoded)).toBe(true);
    expect(await verifyPassword("wrong-password-123", encoded)).toBe(false);
  });

  it("hashes session tokens deterministically", () => {
    expect(hashSessionToken("token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken("token")).toBe(hashSessionToken("token"));
  });
});
