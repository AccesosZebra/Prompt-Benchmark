/**
 * The workflow JSON handed to a client that runs its own n8n.
 *
 * Same duplication the provisioning does, minus the part that needs our
 * instance: the flow is retargeted at the client's own schema and renamed
 * "IA Mensajes <Cliente>", then everything that only means something inside
 * OUR n8n is dropped, so importing it there asks for their credentials
 * instead of carrying dangling references to ours:
 *
 * - `credentials` on every node: ids from our instance, useless in theirs, and
 *   they would also hand over how we name our credentials.
 * - `webhookId`: two flows must not share one, theirs has to be new.
 * - `pinData`: pinned runs carry real lead conversations.
 * - header values of HTTP nodes: the template is a real client's flow, so its
 *   tools carry THAT client's CRM key in a header. Names stay, so the one
 *   importing it sees which headers to fill; Content-Type stays whole.
 * - everything above the workflow itself (id, versionId, active, tags, owner,
 *   timestamps): instance state, not the flow.
 *
 * Pure module, no network, so it can be unit-tested directly.
 */
import { retargetChatsTable } from "./chats-table.ts";
import type { N8nWorkflow } from "./agent-node.ts";

export function buildWorkflowExport(
  source: N8nWorkflow,
  opts: { name: string; schema: string },
): { json: string; retargeted: number } {
  const { workflow, retargeted } = retargetChatsTable(source, opts.schema);
  const nodes = workflow.nodes.map((node) => {
    const { credentials: _c, webhookId: _w, ...rest } = node;
    const headers = rest.parameters?.headerParameters?.parameters;
    if (!Array.isArray(headers)) return rest;
    return {
      ...rest,
      parameters: {
        ...rest.parameters,
        headerParameters: {
          ...rest.parameters!.headerParameters,
          parameters: headers.map((h: { name?: string; value?: unknown }) =>
            String(h?.name ?? "").toLowerCase() === "content-type" ? h : { ...h, value: "" },
          ),
        },
      },
    };
  });
  const exported = {
    name: opts.name,
    nodes,
    connections: workflow.connections,
    settings: workflow.settings ?? {},
  };
  return { json: JSON.stringify(exported, null, 2), retargeted };
}
