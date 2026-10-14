"use client";

import { useCallback, useEffect, useState } from "react";
import { IconPlugConnected } from "@tabler/icons-react";
import type { MaskedConnection } from "@/lib/db/n8n-connections";
import { Button } from "@/components/ui/Button";
import { InfoHint } from "@/components/ui/InfoHint";
import { N8nConnectionFormModal } from "@/components/settings/N8nConnectionFormModal";

/**
 * The API key of a client that runs its own n8n. With it, that client gets the
 * same push and drift as one on Zebra's n8n; without it, the handoff below and
 * a manual binding are all there is. The connection belongs to this client:
 * it is never offered to any other one, and it goes away with the client.
 */
export function ClientN8nConnection({ clientId }: { clientId: string }) {
  const [connection, setConnection] = useState<MaskedConnection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/integrations/n8n?client_id=${clientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: MaskedConnection[]) => {
        setConnection(rows.find((c) => c.client_id === clientId) ?? null);
      })
      .catch(() => setConnection(null))
      .finally(() => setLoaded(true));
  }, [clientId]);

  useEffect(load, [load]);

  if (!loaded) return null;

  return (
    <div className="n8n-card">
      <div className="row-between">
        <p className="section-label" style={{ margin: 0, display: "flex", gap: 6 }}>
          Su n8n
          <InfoHint text="Con la API key de su n8n, promover una versión empuja el prompt a su nodo como con los clientes en el n8n de Zebra. Sin ella, se despliega a mano." />
        </p>
        <Button
          size="sm"
          variant="secondary"
          icon={<IconPlugConnected size={13} />}
          onClick={() => setFormOpen(true)}
        >
          {connection ? "Editar" : "Conectar"}
        </Button>
      </div>
      {connection ? (
        <p className="field-hint" style={{ marginBottom: 0 }}>
          {connection.base_url} · {connection.api_key_masked}
        </p>
      ) : (
        <p className="field-hint" style={{ marginBottom: 0 }}>
          Sin conectar: el prompt se pega a mano en su n8n.
        </p>
      )}

      {formOpen && (
        <N8nConnectionFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={load}
          connection={connection}
          clientId={clientId}
        />
      )}
    </div>
  );
}
