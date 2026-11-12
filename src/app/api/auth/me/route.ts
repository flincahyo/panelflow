import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const oauth = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    github: Boolean(process.env.GITHUB_CLIENT_ID),
  };

  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ user: null, preferences: null, oauth });
    }

    const userRes = await query<{
      id: string;
      email: string;
      name: string | null;
      provider: string;
    }>(
      `SELECT id, email, name, provider FROM users WHERE id = $1 LIMIT 1`,
      [session.userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      return NextResponse.json({ user: null, preferences: null, oauth });
    }

    const prefRes = await query<{
      favorite_part_ids: string[];
      recent_part_ids: string[];
    }>(
      `SELECT favorite_part_ids, recent_part_ids FROM user_preferences WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );

    const prefRow = prefRes.rows[0];

    return NextResponse.json({
      user,
      preferences: {
        favoritePartIds: Array.isArray(prefRow?.favorite_part_ids)
          ? prefRow.favorite_part_ids
          : [],
        recentPartIds: Array.isArray(prefRow?.recent_part_ids)
          ? prefRow.recent_part_ids
          : [],
      },
      oauth,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load session";
    return NextResponse.json({ error: msg, user: null, oauth }, { status: 500 });
  }
}
