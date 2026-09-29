import { NextResponse } from "next/server";
import { isLanguage } from "@/domain/i18n";
import { currentUserId, withUserClient } from "@/db/user-context";

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { language?: unknown } | null;
  if (!isLanguage(body?.language)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  try {
    const userId = currentUserId();
    await withUserClient(userId, (client) => client.query("UPDATE app_users SET preferences=jsonb_set(preferences,'{language}',to_jsonb($1::text),true),updated_at=now() WHERE id=$2", [body.language,userId]));
    const response = NextResponse.json({ language: body.language });
    response.cookies.set("tcf-language", body.language, { sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/", secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Settings update failed" }, { status: 503 });
  }
}
