import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const res = await query<{
        id: string;
        name: string;
        data: unknown;
        thumbnail: string | null;
        updated_at: string;
      }>(
        `SELECT id, name, data, thumbnail, updated_at
         FROM projects
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [id, session.userId]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ project: res.rows[0] });
    }

    const list = await query<{
      id: string;
      name: string;
      thumbnail: string | null;
      updated_at: string;
    }>(
      `SELECT id, name, thumbnail, updated_at
       FROM projects
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ projects: list.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch projects";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = typeof body?.id === "string" && body.id ? body.id : null;
    const name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Untitled Panel Project";
    const data = body?.data;
    const thumbnail = typeof body?.thumbnail === "string" ? body.thumbnail : null;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Project data payload is required" },
        { status: 400 }
      );
    }

    if (id) {
      const updated = await query<{
        id: string;
        name: string;
        thumbnail: string | null;
        updated_at: string;
      }>(
        `UPDATE projects
         SET name = $1, data = $2::jsonb, thumbnail = COALESCE($3, thumbnail), updated_at = NOW()
         WHERE id = $4 AND user_id = $5
         RETURNING id, name, thumbnail, updated_at`,
        [name, JSON.stringify(data), thumbnail, id, session.userId]
      );
      if (updated.rows.length > 0) {
        return NextResponse.json({ project: updated.rows[0] });
      }
    }

    const created = await query<{
      id: string;
      name: string;
      thumbnail: string | null;
      updated_at: string;
    }>(
      `INSERT INTO projects (user_id, name, data, thumbnail, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       RETURNING id, name, thumbnail, updated_at`,
      [session.userId, name, JSON.stringify(data), thumbnail]
    );

    return NextResponse.json({ project: created.rows[0] }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save project";
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
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : null;
    const data = body?.data;
    const thumbnail = typeof body?.thumbnail === "string" ? body.thumbnail : null;

    const updated = await query<{
      id: string;
      name: string;
      thumbnail: string | null;
      updated_at: string;
    }>(
      `UPDATE projects
       SET
         name = COALESCE($1, name),
         data = COALESCE($2::jsonb, data),
         thumbnail = COALESCE($3, thumbnail),
         updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, thumbnail, updated_at`,
      [name, data ? JSON.stringify(data) : null, thumbnail, id, session.userId]
    );

    if (updated.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: updated.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const deleted = await query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, session.userId]
    );
    if (deleted.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
