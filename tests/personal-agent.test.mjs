import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("personal agent is shadow-only by default and has no exchange execution primitive", () => {
  const source = fs.readFileSync(new URL("../src/personal-agent.mjs", import.meta.url), "utf8");
  assert.match(source, /KISA_AGENT_MODE \|\| "shadow"/);
  assert.doesNotMatch(source, /placeOrder|createOrder|submitOrder|exchange.*key/i);
  assert.match(source, /snapshot_id/);
  assert.match(source, /evidence_ids/);
});
