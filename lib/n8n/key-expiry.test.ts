/**
 * Unit tests for the n8n API key expiry helpers.
 * Run with: node --test --experimental-strip-types lib/n8n/key-expiry.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { expiryLabel, keyExpiresAt } from "./key-expiry.ts";

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: unknown) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.firma`;

test("reads exp out of an n8n key", () => {
  // 2027-01-12T00:00:00Z
  assert.equal(keyExpiresAt(jwt({ sub: "u1", exp: 1799712000 })), "2027-01-12T00:00:00.000Z");
});

test("a key without expiry, or not a JWT, has no known expiry", () => {
  assert.equal(keyExpiresAt(jwt({ sub: "u1" })), null);
  assert.equal(keyExpiresAt("n8n_api_0123456789abcdef"), null);
  assert.equal(keyExpiresAt("a.%%%.c"), null);
});

test("label: valid, about to expire, expired", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  assert.equal(expiryLabel("2027-01-12T00:00:00Z", now).warn, false);
  const soon = expiryLabel("2026-10-20T13:00:00Z", now);
  assert.ok(soon.warn && soon.text.includes("6 días"));
  const gone = expiryLabel("2026-10-01T00:00:00Z", now);
  assert.ok(gone.warn && gone.text.includes("caducada"));
});
