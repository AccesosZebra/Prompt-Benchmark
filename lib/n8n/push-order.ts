/**
 * Ordering a multi-target push.
 *
 * n8n's PUT replaces the whole workflow. Two bindings on the same workflow
 * pushed in parallel both read the same version, each changes its own node,
 * and the second PUT erases the first change while both report success. So
 * pushes to one workflow run one after another, and different workflows still
 * run in parallel.
 *
 * The concurrent-edit guard needs care in a chain: our own first write changes
 * the workflow's versionId, so the next push must expect the version that write
 * left, not the one the user saw in the diff. A failed push wrote nothing, so
 * the expectation it had passes on unchanged.
 *
 * Pure module, no network, so it can be unit-tested directly.
 */

export type ChainedOutcome = {
  status: "success" | "error";
  /** The workflow's versionId after a successful write, when n8n returns it. */
  workflow_version_id?: string | null;
};

export function pushPerWorkflowInOrder<T, O extends ChainedOutcome>(
  targets: T[],
  workflowKey: (target: T) => string,
  expectedVersion: (target: T) => string | null,
  push: (target: T, expectedWorkflowVersionId: string | null) => Promise<O>,
): Promise<O[]> {
  // Per workflow: the versionId the next push in its chain must find.
  const chains = new Map<string, Promise<string | null>>();
  return Promise.all(
    targets.map((target) => {
      const key = workflowKey(target);
      const expected = chains.get(key) ?? Promise.resolve(expectedVersion(target));
      const outcome = expected.then((v) => push(target, v));
      chains.set(
        key,
        Promise.all([expected, outcome]).then(([v, o]) =>
          o.status === "success" ? (o.workflow_version_id ?? null) : v,
        ),
      );
      return outcome;
    }),
  );
}
