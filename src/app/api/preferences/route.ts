import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await query<{
      favorite_part_ids: string[];
      recent_part_ids: string[];
    }>(
      `SELECT favorite_part_ids, recent_part_ids
       FROM user_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [session.userId]
    );

    const row = res.rows[0];
    return NextResponse.json({
      favoritePartIds: Array.isArray(row?.favorite_part_ids)
        ? row.favorite_part_ids
        : [],
      recentPartIds: Array.isArray(row?.recent_part_ids)
        ? row.recent_part_ids
        : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch preferences";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const favoritePartIds = Array.isArray(body?.favoritePartIds)
      ? body.favoritePartIds.filter((x: unknown) => typeof x === "string")
      : [];
    const recentPartIds = Array.isArray(body?.recentPartIds)
      ? body.recentPartIds.filter((x: unknown) => typeof x === "string")
      : [];

    await query(
      `INSERT INTO user_preferences (user_id, favorite_part_ids, recent_part_ids, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET favorite_part_ids = EXCLUDED.favorite_part_ids,
           recent_part_ids = EXCLUDED.recent_part_ids,
           updated_at = NOW()`,
      [
        session.userId,
        JSON.stringify(favoritePartIds),
        JSON.stringify(recentPartIds),
      ]
    );

    return NextResponse.json({
      ok: true,
      favoritePartIds,
      recentPartIds,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update preferences";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
