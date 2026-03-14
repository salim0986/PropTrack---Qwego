import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockFindFirstUser, mockFindFirstBuilding, mockFindManyManagers } = vi.hoisted(() => ({
    mockFindFirstUser: vi.fn(),
    mockFindFirstBuilding: vi.fn(),
    mockFindManyManagers: vi.fn(async () => [] as Array<{ id: string }>),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendNotification: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/after-hours", () => ({ isAfterHours: vi.fn(() => false) }));

vi.mock("@/db", () => ({
    db: {
        query: {
            usersTable: { findFirst: mockFindFirstUser, findMany: mockFindManyManagers },
            buildingsTable: { findFirst: mockFindFirstBuilding },
            ticketsTable: { findMany: vi.fn(() => []) },
        },
        transaction: vi.fn(async (cb: any) => {
            const createdTicket = { id: "ticket-new", title: "Leaky faucet in kitchen", status: "OPEN" };
            const mockTx = {
                insert: vi.fn(() => ({
                    values: vi.fn(() => ({
                        returning: vi.fn(() => [createdTicket]),
                    })),
                })),
            };
            return cb(mockTx);
        }),
    },
}));

import { GET, POST } from "@/app/api/tickets/route";
import { auth } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────
const makeSession = (role: string, buildingId = "bld-1") =>
    ({ user: { id: "user-1", role, buildingId } });

const validTicketBody = {
    title: "Leaky faucet in kitchen",
    description: "The faucet is dripping constantly",
    category: "PLUMBING",
    priority: "MEDIUM",
};

const makePostRequest = (body: object) =>
    new Request("http://localhost/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/tickets", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when unauthenticated", async () => {
        (auth as any).mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns 200 for authenticated TENANT", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT"));
        const res = await GET();
        expect(res.status).toBe(200);
    });
});

describe("POST /api/tickets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirstUser.mockResolvedValue({ buildingId: "bld-1", unitNumber: "4B" });
        mockFindFirstBuilding.mockResolvedValue({ id: "bld-1", managerId: "mgr-1", name: "Tower A" });
        mockFindManyManagers.mockResolvedValue([{ id: "mgr-1" }]);
    });

    it("returns 401 when unauthenticated", async () => {
        (auth as any).mockResolvedValue(null);
        const res = await POST(makePostRequest(validTicketBody));
        expect(res.status).toBe(401);
    });

    it("returns 403 when role is MANAGER", async () => {
        (auth as any).mockResolvedValue(makeSession("MANAGER"));
        const res = await POST(makePostRequest(validTicketBody));
        expect(res.status).toBe(403);
    });

    it("returns 403 when role is TECHNICIAN", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN"));
        const res = await POST(makePostRequest(validTicketBody));
        expect(res.status).toBe(403);
    });

    it("returns 400 when user has no buildingId or unitNumber", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT"));
        mockFindFirstUser.mockResolvedValue({ buildingId: null, unitNumber: null });
        const res = await POST(makePostRequest(validTicketBody));
        expect(res.status).toBe(400);
    });

    it("creates ticket successfully for TENANT with complete profile → 201", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT"));
        const res = await POST(makePostRequest(validTicketBody));
        expect(res.status).toBe(201);
    });

    it("returns 400 for title shorter than minimum", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT"));
        const res = await POST(makePostRequest({ ...validTicketBody, title: "Leak" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid category", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT"));
        const res = await POST(makePostRequest({ ...validTicketBody, category: "ROOFING" }));
        expect(res.status).toBe(400);
    });
});
