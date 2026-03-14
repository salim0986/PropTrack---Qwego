import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindManyUsers } = vi.hoisted(() => ({
    mockFindManyUsers: vi.fn(async () => [] as Array<{ id: string; name: string; status: string; specialties: string[]; phone: string }>),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/db", () => ({
    db: {
        query: {
            usersTable: { findMany: mockFindManyUsers },
        },
    },
}));

import { GET } from "@/app/api/technicians/route";
import { auth } from "@/lib/auth";

describe("GET /api/technicians", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when unauthenticated", async () => {
        (auth as any).mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns only active technicians from DB query", async () => {
        (auth as any).mockResolvedValue({ user: { id: "mgr-1", role: "MANAGER" } });

        const payload = [
            { id: "tech-1", name: "Alex", status: "ACTIVE", specialties: ["HVAC"], phone: "123" },
            { id: "tech-2", name: "Sam", status: "ACTIVE", specialties: ["PLUMBING"], phone: "456" },
        ];
        mockFindManyUsers.mockResolvedValue(payload as any);

        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(payload);
    });
});
