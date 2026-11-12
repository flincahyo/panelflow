import { NextResponse } from "next/server";
import {
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  signSessionToken,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : null;

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      return NextResponse.json({ error: pwdErr }, { status: 400 });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1 LIMIT 1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const created = await query<{ id: string; email: string; name: string | null }>(
      `INSERT INTO users (email, password_hash, name, provider)
       VALUES ($1, $2, $3, 'email')
       RETURNING id, email, name`,
      [email, passwordHash, name || null]
    );

    const user = created.rows[0];

    // Seed default preferences
    await query(
      `INSERT INTO user_preferences (user_id, favorite_part_ids, recent_part_ids)
       VALUES ($1, '[]'::jsonb, '[]'::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: "email",
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to register user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
