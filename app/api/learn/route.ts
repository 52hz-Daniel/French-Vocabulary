import { NextResponse } from "next/server";
import { listLibrary } from "@/db/catalog-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const collectionId = new URL(request.url).searchParams.get("collectionId");
  try {
    const result = await listLibrary({ collection: collectionId ?? "", limit: 100 });
    return NextResponse.json({ schemaVersion: 3, entries: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Learn query failed" }, { status: 503 });
  }
}
