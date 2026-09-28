import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

function safeCompare(a, b) {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

describe("Security & Auth Hashing Tests", () => {
  test("Timing safe equal correctly verifies identical hex hashes", () => {
    const hashA = crypto.createHash("sha256").update("password123").digest("hex");
    const hashB = crypto.createHash("sha256").update("password123").digest("hex");
    const hashDiff = crypto.createHash("sha256").update("password456").digest("hex");

    assert.ok(safeCompare(hashA, hashB), "Identical hashes must match");
    assert.strictEqual(safeCompare(hashA, hashDiff), false, "Different hashes must not match");
  });

  test("Password hashing with salt generates distinct hashes for same password", () => {
    const salt1 = crypto.randomBytes(16).toString("hex");
    const salt2 = crypto.randomBytes(16).toString("hex");
    const pass = "secret_pass_123";

    const hash1 = crypto.scryptSync(pass, salt1, 64).toString("hex");
    const hash2 = crypto.scryptSync(pass, salt2, 64).toString("hex");

    assert.notStrictEqual(hash1, hash2, "Salts must produce distinct cryptographic hashes");
  });
});
