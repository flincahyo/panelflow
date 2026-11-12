import { NextResponse } from "next/server";
import {
  normalizeEmail,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  signSessionToken,
  validateEmail,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    const password = typeof body?.password === "string" ? body.password : "";

    if (!validateEmail(email) || !password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    const result = await query<{
      id: string;
      email: string;
      password_hash: string | null;
      name: string | null;
      provider: string;
    }>(
      `SELECT id, email, password_hash, name, provider
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const matched = await verifyPassword(password, user.password_hash);
    if (!matched) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

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
        provider: user.provider,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to log in";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
