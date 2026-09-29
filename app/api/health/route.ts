import { NextResponse } from "next/server";
import { pool } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool().query("SELECT 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "disconnected" },
      { status: 503 },
    );
  }
}
