import { NextResponse } from "next/server";
import { getStudyItem } from "@/db/catalog-repository";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const item = await getStudyItem((await params).id);
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Study item not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Study item query failed" }, { status: 503 });
  }
}
