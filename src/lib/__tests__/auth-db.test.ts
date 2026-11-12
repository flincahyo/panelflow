import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  signSessionToken,
  validateEmail,
  validatePassword,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { ensureSchema, query } from "@/lib/db";

describe("auth helpers and validation", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail("  TEST@Example.Com  ")).toBe("test@example.com");
    expect(validateEmail("user@domain.com")).toBe(true);
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });

  it("validates password length correctly", () => {
    expect(validatePassword("12345")).toBe("Password must be at least 6 characters");
    expect(validatePassword("123456")).toBeNull();
    expect(validatePassword("secure-password")).toBeNull();
  });

  it("hashes and verifies passwords", async () => {
    const raw = "SuperSecret123!";
    const hash = await hashPassword(raw);
    expect(hash).not.toBe(raw);
    expect(await verifyPassword(raw, hash)).toBe(true);
    expect(await verifyPassword("wrong-pass", hash)).toBe(false);
  });

  it("signs and verifies JWT session tokens", async () => {
    const payload = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "engineer@panelflow.local",
      name: "Chief Engineer",
    };
    const token = await signSessionToken(payload);
    expect(typeof token).toBe("string");

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(payload.userId);
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.name).toBe(payload.name);
  });

  it("rejects invalid or tampered JWT tokens", async () => {
    expect(await verifySessionToken("invalid.jwt.token")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });
});

describe("database integration", () => {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);

  it("connects to postgres and verifies schema tables exist", async () => {
    if (!hasDbUrl) {
      console.warn("DATABASE_URL not set; skipping live postgres check");
      return;
    }

    await ensureSchema();

    const tables = await query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('users', 'user_preferences', 'projects', 'custom_parts')`
    );

    const names = tables.rows.map((r) => r.table_name).sort();
    expect(names).toEqual([
      "custom_parts",
      "projects",
      "user_preferences",
      "users",
    ]);
  });
});
