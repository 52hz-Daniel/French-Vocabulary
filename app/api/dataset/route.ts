import { NextResponse } from "next/server";
import { loadDataset } from "@/data/load-dataset";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadDataset());
}
