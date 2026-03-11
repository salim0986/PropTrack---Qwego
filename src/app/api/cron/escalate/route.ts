import { db } from "@/db";
import { ticketsTable, usersTable, buildingsTable } from "@/db/schema";
import { eq, and, inArray, lt, not } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";

// Validates the CRON_SECRET to prevent unauthorized triggers
function isCronAuthorized(req: Request): boolean {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request) {
    if (!isCronAuthorized(req)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const escalationThresholdMs = 4 * 60 * 60 * 1000; // 4 hours
    const escalationCutoff = new Date(now.getTime() - escalationThresholdMs);

    // Find tickets that have been in ASSIGNED status for over 4 hours without progress
    const stalledTickets = await db.query.ticketsTable.findMany({
        where: and(
            inArray(ticketsTable.status, ["ASSIGNED", "OPEN"]),
            lt(ticketsTable.updatedAt, escalationCutoff),
            not(eq(ticketsTable.status, "DONE"))
        ),
        with: {
            building: { columns: { managerId: true, name: true } },
            tenant: { columns: { name: true } },
        },
    });

    const escalationResults: string[] = [];

    for (const ticket of stalledTickets) {
        if (!ticket.building?.managerId) continue;

        const hoursStalled = Math.round((now.getTime() - new Date(ticket.updatedAt).getTime()) / 1000 / 60 / 60);

        await sendNotification({
            userId: ticket.building.managerId,
            ticketId: ticket.id,
            title: "⚠️ Escalation: Stalled Ticket",
            message: `Ticket "${ticket.title}" has been stalled for ${hoursStalled}h. ${ticket.technicianId ? "Technician has not updated." : "No technician assigned!"} Building: ${ticket.building.name}.`,
            type: "ESCALATION",
        });

        escalationResults.push(ticket.id);
    }

    // Also escalate URGENT/HIGH priority OPEN tickets (unassigned > 1 hour)
    const urgentUnassigned = await db.query.ticketsTable.findMany({
        where: and(
            inArray(ticketsTable.status, ["OPEN"]),
            inArray(ticketsTable.priority, ["URGENT", "HIGH"]),
            lt(ticketsTable.updatedAt, new Date(now.getTime() - 60 * 60 * 1000)), // 1 hour
        ),
        with: { building: { columns: { managerId: true, name: true } } },
    });

    for (const ticket of urgentUnassigned) {
        if (!ticket.building?.managerId) continue;
        await sendNotification({
            userId: ticket.building.managerId,
            ticketId: ticket.id,
            title: "🚨 Urgent Ticket Unassigned",
            message: `Urgent ticket "${ticket.title}" has been unassigned for over 1 hour. Immediate action required.`,
            type: "ESCALATION",
        });
    }

    return NextResponse.json({
        escalated: escalationResults.length,
        urgentEscalated: urgentUnassigned.length,
        timestamp: now.toISOString(),
    });
}
