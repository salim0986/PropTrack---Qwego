import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockFindFirstTicket, mockFindFirstActivityLog } = vi.hoisted(() => ({
    mockFindFirstTicket: vi.fn(),
    mockFindFirstActivityLog: vi.fn(async () => null as { id: string; action: string } | null), // null = no existing log (on_the_way not already sent)
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendNotification: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/after-hours", () => ({ isAfterHours: vi.fn(() => false) }));
vi.mock("@/db", () => ({
    db: {
        query: {
            ticketsTable: { findFirst: mockFindFirstTicket },
            activityLogsTable: { findFirst: mockFindFirstActivityLog },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve()),
            })),
        })),
        insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
        transaction: vi.fn(async (cb: any) => {
            const mockTx = {
                update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
                insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
            };
            return cb(mockTx);
        }),
    },
}));

import { PATCH } from "@/app/api/tickets/[id]/status/route";
import { auth } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────
const makeSession = (role: string, id = "user-1") => ({ user: { id, role } });
const makeParams = (id = "ticket-1") => Promise.resolve({ id });
const makeRequest = (body: object) =>
    new Request("http://localhost/api/tickets/ticket-1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

const baseBuilding = { managerId: "mgr-1", businessHoursStart: 9, businessHoursEnd: 17, businessDays: [1,2,3,4,5] };
const baseTicket = {
    id: "ticket-1", title: "Dripping tap", technicianId: "tech-1", tenantId: "ten-1", unitNumber: "4B",
    building: baseBuilding,
    technician: { id: "tech-1", name: "Bob Tech" },
    tenant: { id: "ten-1", name: "Alice T" },
};
const openTicket     = { ...baseTicket, status: "OPEN" };
const assignedTicket = { ...baseTicket, status: "ASSIGNED" };
const inProgressTicket = { ...baseTicket, status: "IN_PROGRESS" };
const blockedTicket  = { ...baseTicket, status: "BLOCKED" };
const doneTicket     = { ...baseTicket, status: "DONE" };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PATCH /api/tickets/[id]/status", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when unauthenticated", async () => {
        (auth as any).mockResolvedValue(null);
        const res = await PATCH(makeRequest({ action: "ON_THE_WAY" }), { params: makeParams() });
        expect(res.status).toBe(401);
    });

    it("returns 404 when ticket not found", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(null);
        const res = await PATCH(makeRequest({ action: "ON_THE_WAY" }), { params: makeParams() });
        expect(res.status).toBe(404);
    });

    // ON_THE_WAY — does NOT check status, only idempotency via activity log
    it("action ON_THE_WAY: 403 if not the assigned technician", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "other-tech"));
        mockFindFirstTicket.mockResolvedValue(assignedTicket);
        const res = await PATCH(makeRequest({ action: "ON_THE_WAY" }), { params: makeParams() });
        expect(res.status).toBe(403);
    });

    it("action ON_THE_WAY: 200 for assigned technician (idempotent, no status check)", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(assignedTicket);
        mockFindFirstActivityLog.mockResolvedValue(null); // not already sent
        const res = await PATCH(makeRequest({ action: "ON_THE_WAY" }), { params: makeParams() });
        expect(res.status).toBe(200);
    });

    it("action ON_THE_WAY: 200 (alreadySent) when notification was already sent", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(assignedTicket);
        mockFindFirstActivityLog.mockResolvedValue({ id: "log-1", action: "ON_THE_WAY" }); // already sent
        const res = await PATCH(makeRequest({ action: "ON_THE_WAY" }), { params: makeParams() });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alreadySent).toBe(true);
    });

    // START — accepts ASSIGNED or REOPENED only
    it("action START: 403 if not the assigned technician", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "wrong-tech"));
        mockFindFirstTicket.mockResolvedValue(assignedTicket);
        const res = await PATCH(makeRequest({ action: "START" }), { params: makeParams() });
        expect(res.status).toBe(403);
    });

    it("action START: 400 if ticket is not ASSIGNED or REOPENED (is OPEN)", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(openTicket); // OPEN — not startable
        const res = await PATCH(makeRequest({ action: "START" }), { params: makeParams() });
        expect(res.status).toBe(400);
    });

    it("action START: 200 for assigned technician on ASSIGNED ticket", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(assignedTicket);
        const res = await PATCH(makeRequest({ action: "START" }), { params: makeParams() });
        expect(res.status).toBe(200);
    });

    it("action BLOCK: 400 without blockReason", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(inProgressTicket);
        const res = await PATCH(makeRequest({ action: "BLOCK" }), { params: makeParams() });
        expect(res.status).toBe(400);
    });

    it("action BLOCK: 200 with valid blockReason", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(inProgressTicket);
        const res = await PATCH(makeRequest({ action: "BLOCK", blockReason: "Waiting for parts" }), { params: makeParams() });
        expect(res.status).toBe(200);
    });

    it("action COMPLETE: 403 for TENANT", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT", "ten-1"));
        mockFindFirstTicket.mockResolvedValue(inProgressTicket);
        const res = await PATCH(makeRequest({
            action: "COMPLETE",
            resolutionNotes: "Fixed the pipes thoroughly",
            imageUrls: ["https://bucket.s3.amazonaws.com/img.jpg"],
        }), { params: makeParams() });
        expect(res.status).toBe(403);
    });

    it("action COMPLETE: 200 for assigned technician", async () => {
        (auth as any).mockResolvedValue(makeSession("TECHNICIAN", "tech-1"));
        mockFindFirstTicket.mockResolvedValue(inProgressTicket);
        const res = await PATCH(makeRequest({
            action: "COMPLETE",
            resolutionNotes: "Fixed the pipes thoroughly",
            imageUrls: ["https://bucket.s3.amazonaws.com/img.jpg"],
        }), { params: makeParams() });
        expect(res.status).toBe(200);
    });

    it("action REOPEN: 403 for TENANT", async () => {
        (auth as any).mockResolvedValue(makeSession("TENANT", "ten-1"));
        mockFindFirstTicket.mockResolvedValue(doneTicket);
        const res = await PATCH(makeRequest({ action: "REOPEN", reason: "Not fixed properly" }), { params: makeParams() });
        expect(res.status).toBe(403);
    });

    it("action REOPEN: 200 for MANAGER on DONE ticket", async () => {
        (auth as any).mockResolvedValue(makeSession("MANAGER", "mgr-1"));
        mockFindFirstTicket.mockResolvedValue(doneTicket);
        const res = await PATCH(makeRequest({ action: "REOPEN", reason: "Not fully resolved still leaking" }), { params: makeParams() });
        expect(res.status).toBe(200);
    });

    it("action UNBLOCK: 200 for MANAGER on BLOCKED ticket", async () => {
        (auth as any).mockResolvedValue(makeSession("MANAGER", "mgr-1"));
        mockFindFirstTicket.mockResolvedValue(blockedTicket);
        const res = await PATCH(makeRequest({ action: "UNBLOCK", unblockNote: "Parts have arrived now" }), { params: makeParams() });
        expect(res.status).toBe(200);
    });
});
