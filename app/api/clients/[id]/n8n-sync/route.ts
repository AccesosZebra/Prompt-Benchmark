import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listBindings } from "@/lib/db/n8n-bindings";
import { getVersion } from "@/lib/db/versions";
import { pushBinding, type PushOutcome } from "@/lib/n8n/sync";
import { pushPerWorkflowInOrder } from "@/lib/n8n/push-order";
import { handleError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  version_id: z.string().uuid(),
  targets: z
    .array(
      z.object({
        binding_id: z.string().uuid(),
        expected_workflow_version_id: z.string().nullable().optional(),
      }),
    )
    .min(1, "No hay destinos que sincronizar."),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Pushes `version_id` to the requested API bindings. Each target may carry the
 * workflow versionId seen in the diff so a concurrent edit aborts that push.
 * Returns a per-binding outcome; a partial failure does not roll back the rest.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { version_id, targets } = schema.parse(await req.json());

    const version = await getVersion(version_id);
    if (!version || version.client_id !== id) return jsonError("Versión no encontrada.", 404);

    const bindings = await listBindings(id);
    const byId = new Map(bindings.map((b) => [b.id, b]));
    const nowIso = new Date().toISOString();

    // Two bindings on one workflow must not be pushed in parallel: each PUT
    // replaces the whole workflow and the last one would erase the other.
    const outcomes = await pushPerWorkflowInOrder(
      targets,
      // An unknown binding gets its own key: it fails without touching n8n.
      (t) => {
        const b = byId.get(t.binding_id);
        return b ? `${b.connection_id}/${b.workflow_id}` : `missing/${t.binding_id}`;
      },
      (t) => t.expected_workflow_version_id ?? null,
      async (t, expectedWorkflowVersionId): Promise<PushOutcome> => {
        const binding = byId.get(t.binding_id);
        if (!binding) {
          return { binding_id: t.binding_id, status: "error", message: "Vínculo no encontrado." };
        }
        return pushBinding(
          binding,
          { id: version.id, content: version.content },
          { expectedWorkflowVersionId, nowIso },
        );
      },
    );

    return NextResponse.json(outcomes);
  } catch (err) {
    return handleError(err);
  }
}
