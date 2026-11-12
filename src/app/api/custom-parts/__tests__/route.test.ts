import { describe, expect, it, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/custom-parts/route";

vi.mock("@/lib/auth", () => ({
  getSessionFromCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
}));

import { getSessionFromCookies } from "@/lib/auth";
import { query } from "@/lib/db";

const mockedGetSession = vi.mocked(getSessionFromCookies);
const mockedQuery = vi.mocked(query);

describe("/api/custom-parts PATCH & DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 on PATCH when unauthenticated", async () => {
    mockedGetSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/custom-parts", {
      method: "PATCH",
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", name: "New Name" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on PATCH when name or id is missing or invalid UUID", async () => {
    mockedGetSession.mockResolvedValue({
      userId: "00000000-0000-0000-0000-000000000099",
      email: "test@example.com",
      name: "Test",
    });

    const reqMissing = new Request("http://localhost/api/custom-parts", {
      method: "PATCH",
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", name: "   " }),
    });
    expect((await PATCH(reqMissing)).status).toBe(400);

    const reqBadUuid = new Request("http://localhost/api/custom-parts", {
      method: "PATCH",
      body: JSON.stringify({ id: "cad-12345", name: "Valid Name" }),
    });
    expect((await PATCH(reqBadUuid)).status).toBe(400);
  });

  it("returns 200 and updated part on valid PATCH", async () => {
    const partId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000099";
    mockedGetSession.mockResolvedValueOnce({ userId, email: "a@b.com", name: "A" });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: partId,
          name: "Renamed Breaker",
          format: "dxf",
          bounding_box: { w: 45, h: 77, d: 20 },
          pins: [],
          cad_data: null,
          created_at: "2026-11-12T00:00:00Z",
        },
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const req = new Request("http://localhost/api/custom-parts", {
      method: "PATCH",
      body: JSON.stringify({ id: partId, name: "  Renamed Breaker  " }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.part.name).toBe("Renamed Breaker");
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE custom_parts"),
      ["Renamed Breaker", partId, userId]
    );
  });

  it("returns 404 on PATCH when part does not exist or belongs to another user", async () => {
    mockedGetSession.mockResolvedValueOnce({
      userId: "00000000-0000-0000-0000-000000000099",
      email: "a@b.com",
      name: "A",
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      command: "UPDATE",
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const req = new Request("http://localhost/api/custom-parts", {
      method: "PATCH",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000002",
        name: "Other",
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DELETE with non-UUID id", async () => {
    mockedGetSession.mockResolvedValueOnce({
      userId: "00000000-0000-0000-0000-000000000099",
      email: "a@b.com",
      name: "A",
    });
    const req = new Request("http://localhost/api/custom-parts?id=cad-local-1", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
