import { NextRequest, NextResponse } from "next/server";
import { listConnections, createConnection } from "@/lib/db/n8n-connections";
import { createConnectionSchema } from "@/lib/schemas/n8n";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Zebra's connections; with `?client_id=`, that client's own one too; with
 * `?scope=all`, every connection (Ajustes lists them all, binds none).
 */
export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("client_id");
    if (clientId && !z.string().uuid().safeParse(clientId).success) {
      return jsonError("client_id no válido.", 400);
    }
    const all = req.nextUrl.searchParams.get("scope") === "all";
    return NextResponse.json(await listConnections({ clientId: clientId ?? undefined, all }));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = createConnectionSchema.parse(await req.json());
    const created = await createConnection(input);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
