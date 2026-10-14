/**
 * Data access for n8n connections (reachable n8n instances).
 *
 * Keys are stored encrypted (lib/crypto.ts) and NEVER returned in plaintext
 * through these helpers, except `getConnectionCreds`, which is for internal
 * server-side use by the sync engine / API routes and must never be exposed
 * to the client.
 */
import { getSupabase } from "../supabase";
import { encrypt, decrypt } from "../crypto";
import type { N8nConnectionCreds } from "../n8n/client";
import { keyExpiresAt } from "../n8n/key-expiry";

export type MaskedConnection = {
  id: string;
  name: string;
  base_url: string;
  api_key_masked: string;
  /** Read from the key itself (n8n keys are JWTs); null when it does not say. */
  api_key_expires_at: string | null;
  // Base workflow duplicated for a new client (Sprint 16). Null when this
  // connection has no template configured. One pair per CRM: the unsuffixed
  // columns are Kommo's, which is why they keep their original names.
  template_workflow_id: string | null;
  template_workflow_name: string | null;
  template_workflow_id_ghl: string | null;
  template_workflow_name_ghl: string | null;
  // Null for a Zebra connection (offered to every client). Set when it is one
  // client's own n8n: offered only to that client, never holds a template.
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Custom error so API routes can map a delete conflict to HTTP 409. */
export class ConnectionInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionInUseError";
  }
}

/** Two base URLs that reach the same n8n: case and trailing slashes aside. */
export function sameInstance(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "");
  return norm(a) === norm(b);
}

function maskKey(plain: string): string {
  return `••••${plain.slice(-4)}`;
}

function maskFromEncrypted(encrypted: string): { masked: string; expiresAt: string | null } {
  try {
    const plain = decrypt(encrypted);
    return { masked: maskKey(plain), expiresAt: keyExpiresAt(plain) };
  } catch {
    // Key present but undecryptable (e.g. KEY_ENCRYPTION_SECRET rotated).
    return { masked: "•••• (no legible)", expiresAt: null };
  }
}

function toMasked(row: any): MaskedConnection {
  const key = maskFromEncrypted(row.api_key_encrypted);
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    api_key_masked: key.masked,
    api_key_expires_at: key.expiresAt,
    template_workflow_id: row.template_workflow_id ?? null,
    template_workflow_name: row.template_workflow_name ?? null,
    template_workflow_id_ghl: row.template_workflow_id_ghl ?? null,
    template_workflow_name_ghl: row.template_workflow_name_ghl ?? null,
    client_id: row.client_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Zebra's connections, plus `clientId`'s own one when given. A client's
 * connection is never listed for anyone else, so another client's prompt can
 * not be bound to it. `clientId` must be a validated UUID: it goes into a filter.
 */
export async function listConnections(clientId?: string): Promise<MaskedConnection[]> {
  const sb = getSupabase();
  let query = sb.from("n8n_connections").select("*");
  query = clientId
    ? query.or(`client_id.is.null,client_id.eq.${clientId}`)
    : query.is("client_id", null);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(`No se pudieron listar las conexiones n8n: ${error.message}`);
  return (data ?? []).map(toMasked);
}

export async function getConnection(id: string): Promise<MaskedConnection | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("n8n_connections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo obtener la conexión n8n: ${error.message}`);
  return data ? toMasked(data) : null;
}

export async function createConnection(input: {
  name: string;
  base_url: string;
  api_key: string;
  client_id?: string | null;
}): Promise<MaskedConnection> {
  const sb = getSupabase();
  // Same instance twice would split its workflows across two connections, and
  // the adopt-by-name in provisioning only looks inside one.
  const { data: all, error: allErr } = await sb.from("n8n_connections").select("name, base_url");
  if (allErr) throw new Error(`No se pudieron revisar las conexiones n8n: ${allErr.message}`);
  const same = (all ?? []).find((c) => sameInstance(c.base_url, input.base_url));
  if (same) {
    throw new ConnectionInUseError(`Esa instancia de n8n ya está dada de alta como «${same.name}».`);
  }
  const { data, error } = await sb
    .from("n8n_connections")
    .insert({
      name: input.name,
      base_url: input.base_url,
      api_key_encrypted: encrypt(input.api_key),
      client_id: input.client_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`No se pudo crear la conexión n8n: ${error.message}`);
  return toMasked(data);
}

export async function updateConnection(
  id: string,
  input: {
    name?: string;
    base_url?: string;
    api_key?: string;
    template_workflow_id?: string | null;
    template_workflow_name?: string | null;
    template_workflow_id_ghl?: string | null;
    template_workflow_name_ghl?: string | null;
  },
): Promise<MaskedConnection> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.base_url !== undefined) {
    const { data: all, error: allErr } = await sb
      .from("n8n_connections")
      .select("name, base_url")
      .neq("id", id);
    if (allErr) throw new Error(`No se pudieron revisar las conexiones n8n: ${allErr.message}`);
    const same = (all ?? []).find((c) => sameInstance(c.base_url, input.base_url!));
    if (same) {
      throw new ConnectionInUseError(`Esa instancia de n8n ya está dada de alta como «${same.name}».`);
    }
    patch.base_url = input.base_url;
  }
  // Re-encrypt only when a new key is provided; blank leaves the existing one.
  if (input.api_key) patch.api_key_encrypted = encrypt(input.api_key);
  if (input.template_workflow_id !== undefined) {
    patch.template_workflow_id = input.template_workflow_id;
  }
  if (input.template_workflow_name !== undefined) {
    patch.template_workflow_name = input.template_workflow_name;
  }
  if (input.template_workflow_id_ghl !== undefined) {
    patch.template_workflow_id_ghl = input.template_workflow_id_ghl;
  }
  if (input.template_workflow_name_ghl !== undefined) {
    patch.template_workflow_name_ghl = input.template_workflow_name_ghl;
  }

  const { data, error } = await sb
    .from("n8n_connections")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`No se pudo actualizar la conexión n8n: ${error.message}`);
  return toMasked(data);
}

export async function deleteConnection(id: string): Promise<void> {
  const sb = getSupabase();
  // Bindings reference the connection with ON DELETE RESTRICT at the DB level;
  // check here first so we can return a friendly Spanish message.
  const { data: refs, error: refErr } = await sb
    .from("n8n_bindings")
    .select("id")
    .eq("connection_id", id)
    .limit(1);
  if (refErr) throw new Error(`No se pudo verificar la conexión n8n: ${refErr.message}`);
  if (refs && refs.length > 0) {
    throw new ConnectionInUseError(
      "No se puede eliminar la conexión: hay clientes vinculados a ella. Desvincúlalos primero.",
    );
  }
  const { error } = await sb.from("n8n_connections").delete().eq("id", id);
  if (error) throw new Error(`No se pudo eliminar la conexión n8n: ${error.message}`);
}

/**
 * Returns the base URL + plaintext API key for a connection. INTERNAL USE
 * ONLY (sync engine / server-side API routes). Never expose via a response.
 */
export async function getConnectionCreds(id: string): Promise<N8nConnectionCreds> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("n8n_connections")
    .select("base_url, api_key_encrypted")
    .eq("id", id)
    .single();
  if (error) throw new Error(`No se pudo obtener la conexión n8n: ${error.message}`);
  return { baseUrl: data.base_url, apiKey: decrypt(data.api_key_encrypted) };
}

/**
 * Archiving a client deletes the key to its own n8n: holding a third party's
 * key with nothing to push is pure risk, and after the 90 days the team gives
 * every key it would be dead anyway. Its bindings to that instance go first
 * (they point at it); the sync history keeps its events, unlinked. Zebra's
 * connections are never touched. Unarchiving means connecting again.
 */
export async function deleteClientConnection(clientId: string): Promise<void> {
  const sb = getSupabase();
  const { data: own, error } = await sb.from("n8n_connections").select("id").eq("client_id", clientId);
  if (error) throw new Error(`No se pudo revisar el n8n del cliente: ${error.message}`);
  const ids = (own ?? []).map((c) => c.id);
  if (ids.length === 0) return;
  const { error: bErr } = await sb.from("n8n_bindings").delete().in("connection_id", ids);
  if (bErr) throw new Error(`No se pudieron quitar los vínculos a su n8n: ${bErr.message}`);
  const { error: cErr } = await sb.from("n8n_connections").delete().in("id", ids);
  if (cErr) throw new Error(`No se pudo borrar la conexión a su n8n: ${cErr.message}`);
}
