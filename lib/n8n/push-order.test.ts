/**
 * Unit tests for pushPerWorkflowInOrder.
 * Run with: node --test --experimental-strip-types lib/n8n/push-order.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { pushPerWorkflowInOrder } from "./push-order.ts";

type Target = { id: string; workflow: string; expected: string | null };

/** A fake n8n: each workflow has a versionId that every successful write bumps. */
function fakeN8n(failIds: string[] = []) {
  const versions = new Map<string, number>();
  const log: string[] = [];
  let running = 0;
  let maxParallelOnOne = 0;
  const busy = new Map<string, number>();
  const push = async (t: Target, expected: string | null) => {
    busy.set(t.workflow, (busy.get(t.workflow) ?? 0) + 1);
    maxParallelOnOne = Math.max(maxParallelOnOne, busy.get(t.workflow)!);
    running++;
    await new Promise((r) => setTimeout(r, 5));
    running--;
    busy.set(t.workflow, busy.get(t.workflow)! - 1);
    const current = `v${versions.get(t.workflow) ?? 0}`;
    log.push(`${t.id}:${expected}`);
    if (expected !== current || failIds.includes(t.id)) {
      return { id: t.id, status: "error" as const };
    }
    versions.set(t.workflow, (versions.get(t.workflow) ?? 0) + 1);
    return { id: t.id, status: "success" as const, workflow_version_id: `v${versions.get(t.workflow)}` };
  };
  return { push, log, maxParallel: () => maxParallelOnOne };
}

const run = (targets: Target[], n8n: ReturnType<typeof fakeN8n>) =>
  pushPerWorkflowInOrder(targets, (t) => t.workflow, (t) => t.expected, n8n.push);

test("two bindings on one workflow both land, each expecting the version the previous left", async () => {
  const n8n = fakeN8n();
  const out = await run(
    [
      { id: "a", workflow: "w1", expected: "v0" },
      { id: "b", workflow: "w1", expected: "v0" },
    ],
    n8n,
  );
  assert.deepEqual(out.map((o) => o.status), ["success", "success"]);
  assert.deepEqual(n8n.log, ["a:v0", "b:v1"]);
  assert.equal(n8n.maxParallel(), 1);
});

test("a failed push passes its expectation on, since it wrote nothing", async () => {
  const n8n = fakeN8n(["a"]);
  const out = await run(
    [
      { id: "a", workflow: "w1", expected: "v0" },
      { id: "b", workflow: "w1", expected: "v0" },
    ],
    n8n,
  );
  assert.deepEqual(out.map((o) => o.status), ["error", "success"]);
  assert.deepEqual(n8n.log, ["a:v0", "b:v0"]);
});

test("a stale diff still aborts the chain: the guard is not bypassed", async () => {
  const n8n = fakeN8n();
  const out = await run([{ id: "a", workflow: "w1", expected: "v9" }], n8n);
  assert.deepEqual(out.map((o) => o.status), ["error"]);
});

test("different workflows still go in parallel, outcomes keep the target order", async () => {
  const n8n = fakeN8n();
  const out = await run(
    [
      { id: "a", workflow: "w1", expected: "v0" },
      { id: "b", workflow: "w2", expected: "v0" },
    ],
    n8n,
  );
  assert.deepEqual(out.map((o) => o.id), ["a", "b"]);
  assert.deepEqual(out.map((o) => o.status), ["success", "success"]);
});
