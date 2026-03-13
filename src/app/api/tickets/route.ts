import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, ticketImagesTable, activityLogsTable, usersTable, buildingsTable } from "@/db/schema";
import { ticketSchema } from "@/lib/validations";
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { sendNotification } from "@/lib/notify";
import { isAfterHours } from "@/lib/after-hours";

// ── GET: role-aware ticket listing ──────────────────────────────────────────
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const userId = session.user.id;
        const role = session.user.role;

        let tickets: any[] = [];

        if (role === "MANAGER") {
            // Manager sees all tickets
            tickets = await db.query.ticketsTable.findMany({
                orderBy: [desc(ticketsTable.updatedAt)],
                with: {
                    building: { columns: { name: true } },
                    tenant: { columns: { name: true } },
                    technician: { columns: { name: true } },
                },
            });
        } else if (role === "TENANT") {
            // Tenant sees only their own tickets
            tickets = await db.query.ticketsTable.findMany({
                where: eq(ticketsTable.tenantId, userId),
                orderBy: [desc(ticketsTable.createdAt)],
                with: {
                    building: { columns: { name: true } },
                    technician: { columns: { name: true } },
                    images: { columns: { url: true, type: true } },
                },
            });
        } else if (role === "TECHNICIAN") {
            // Technician sees only assigned tickets
            tickets = await db.query.ticketsTable.findMany({
                where: eq(ticketsTable.technicianId, userId),
                orderBy: [desc(ticketsTable.updatedAt)],
                with: {
                    building: { columns: { name: true, address: true } },
                    tenant: { columns: { name: true, phone: true } },
                },
            });
        }

        return NextResponse.json(tickets);
    } catch (error) {
        console.error("GET /api/tickets error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

// ── POST: tenant creates a new ticket ───────────────────────────────────────
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const role = session.user.role;
        // Only tenants can create tickets
        if (role !== "TENANT") {
            return NextResponse.json({ message: "Only tenants can submit maintenance requests" }, { status: 403 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const validatedData = ticketSchema.parse(body);

        // Fetch user's building
        const user = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, userId),
            columns: { buildingId: true, unitNumber: true },
        });

        if (!user?.buildingId || !user?.unitNumber) {
            return NextResponse.json({ message: "User profile incomplete. Building/Unit missing." }, { status: 400 });
        }

        const ticketAfterHours = isAfterHours();

        // 1. Transactional Insert
        const result = await db.transaction(async (tx) => {
            const [ticket] = await tx.insert(ticketsTable).values({
                title: validatedData.title,
                description: validatedData.description,
                category: validatedData.category as any,
                priority: (validatedData.priority as any) || "MEDIUM",
                tenantId: userId,
                buildingId: user.buildingId!,
                unitNumber: user.unitNumber!,
                submittedAfterHours: ticketAfterHours,
            }).returning();

            // Create Images
            if (validatedData.imageUrls && validatedData.imageUrls.length > 0) {
                await tx.insert(ticketImagesTable).values(
                    validatedData.imageUrls.map((url) => ({
                        ticketId: ticket.id,
                        url,
                        uploadedBy: userId,
                        type: "REPORT" as const,
                    }))
                );
            }

            // Create Activity Log
            await tx.insert(activityLogsTable).values({
                ticketId: ticket.id,
                actorId: userId,
                action: "CREATED" as const,
                message: "Ticket created by tenant",
            });

            return ticket;
        });

        // 2. Self-notify tenant (spec 5.5)
        await sendNotification({
            userId,
            ticketId: result.id,
            title: "✅ Ticket Received",
            message: `Your request "${result.title}" has been submitted. A manager will assign a technician shortly.`,
            type: "TICKET_CREATED",
        });

        // 3. Notify ALL managers for this building
        const building = await db.query.buildingsTable.findFirst({
            where: eq(buildingsTable.id, user.buildingId!),
            columns: { managerId: true, name: true },
        });

        if (building) {
            // Find all managers (the building's manager + any others)
            const allManagers = await db.query.usersTable.findMany({
                where: eq(usersTable.role, "MANAGER"),
                columns: { id: true },
            });

            await Promise.allSettled(
                allManagers.map((m) =>
                    sendNotification({
                        userId: m.id,
                        ticketId: result.id,
                        title: "New Ticket Reported",
                        message: `Tenant in Unit ${user.unitNumber} (${building.name}) reported: ${result.title}`,
                        type: "TICKET_CREATED",
                    })
                )
            );
        }

        return NextResponse.json(result, { status: 201 });

    } catch (error: any) {
        console.error("Ticket Creation Error:", error);
        if (error?.name === "ZodError" || error?.issues) {
            const message = error?.errors?.[0]?.message ?? error?.issues?.[0]?.message ?? "Invalid ticket data";
            return NextResponse.json({ message }, { status: 400 });
        }
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
