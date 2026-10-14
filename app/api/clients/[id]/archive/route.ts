import { NextRequest, NextResponse } from "next/server";
import { archiveClient } from "@/lib/db/clients";
import { deleteClientConnection } from "@/lib/db/n8n-connections";
import { handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    // Key first: if this fails the client stays active and archiving can be
    // retried, instead of an archived client still holding a live key.
    await deleteClientConnection(id);
    return NextResponse.json(await archiveClient(id));
  } catch (err) {
    return handleError(err);
  }
}
