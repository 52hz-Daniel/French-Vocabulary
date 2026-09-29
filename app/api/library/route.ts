import { NextResponse } from "next/server";
import { listLibrary, listLibraryOptions } from "@/db/catalog-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const sort = params.get("sort");
  const direction = params.get("direction");
  try {
    if (params.get("options") === "true") return NextResponse.json(await listLibraryOptions());
    return NextResponse.json(await listLibrary({
      query: params.get("q") ?? "",
      collection: params.get("collection") ?? "",
      status: status === "review" || status === "difficult" || status === "new" ? status : "all",
      favorite: params.get("favorite") === "true",
      sort: sort === "meaning" || sort === "status" || sort === "due" ? sort : "lemma",
      direction: direction === "desc" ? "desc" : "asc",
      cursor: params.get("cursor") ?? undefined,
      limit: Number(params.get("limit") ?? 40),
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Library query failed" }, { status: 503 });
  }
}
