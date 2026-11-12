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
      id: string;
      name: string;
      format: string;
      bounding_box: unknown;
      pins: unknown;
      cad_data: string | null;
      created_at: string;
    }>(
      `SELECT id, name, format, bounding_box, pins, cad_data, created_at
       FROM custom_parts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ parts: res.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load custom parts";
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const format = typeof body?.format === "string" ? body.format.trim() : "";
    const boundingBox = body?.bounding_box;
    const pins = Array.isArray(body?.pins) ? body.pins : [];
    const cadData = typeof body?.cad_data === "string" ? body.cad_data : null;

    if (!name || !format || !boundingBox) {
      return NextResponse.json(
        { error: "name, format, and bounding_box are required" },
        { status: 400 }
      );
    }

    const res = await query<{
      id: string;
      name: string;
      format: string;
      bounding_box: unknown;
      pins: unknown;
      cad_data: string | null;
      created_at: string;
    }>(
      `INSERT INTO custom_parts (user_id, name, format, bounding_box, pins, cad_data)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       RETURNING id, name, format, bounding_box, pins, cad_data, created_at`,
      [
        session.userId,
        name,
        format.slice(0, 10),
        JSON.stringify(boundingBox),
        JSON.stringify(pins),
        cadData,
      ]
    );

    return NextResponse.json({ part: res.rows[0] }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save custom part";
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
      return NextResponse.json({ error: "Part id is required" }, { status: 400 });
    }

    const deleted = await query(
      `DELETE FROM custom_parts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, session.userId]
    );

    if (deleted.rows.length === 0) {
      return NextResponse.json({ error: "Custom part not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete custom part";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
