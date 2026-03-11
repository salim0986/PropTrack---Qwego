import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, ticketImagesTable, activityLogsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";
import { z } from "zod";

const statusUpdateSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("ON_THE_WAY") }),
    z.object({ action: z.literal("BLOCK"), blockReason: z.string().min(5) }),
    z.object({
        action: z.literal("COMPLETE"),
        resolutionNotes: z.string().min(20, "Resolution notes must be at least 20 characters"),
        imageUrl: z.string().url("A proof photo URL is required"),
    }),
    z.object({ action: z.literal("REOPEN") }),
    z.object({ action: z.literal("UNBLOCK") }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const userId = session.user.id;
        const body = await req.json();
        const parsed = statusUpdateSchema.parse(body);

        // Fetch ticket to verify ownership
        const ticket = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, id),
            with: { building: true, tenant: true },
        });

        if (!ticket) return NextResponse.json({ message: "Ticket not found" }, { status: 404 });

        // Only the assigned technician or a manager can update
        const isAssigned = ticket.technicianId === userId;
        const isTech = session.user.role === "TECHNICIAN";
        const isManager = session.user.role === "MANAGER";

        if (!isAssigned && !isManager) {
            return NextResponse.json({ message: "Not authorized for this ticket" }, { status: 403 });
        }

        if (parsed.action === "ON_THE_WAY") {
            await db.transaction(async (tx) => {
                await tx.update(ticketsTable).set({ status: "IN_PROGRESS" }).where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "ON_THE_WAY",
                    message: "Technician is on the way",
                });
            });

            // Notify tenant
            await sendNotification({
                userId: ticket.tenantId,
                ticketId: id,
                title: "Technician On The Way",
                message: `Your ticket "${ticket.title}" is being attended to. Technician is en route.`,
                type: "ON_THE_WAY",
            });

        } else if (parsed.action === "BLOCK") {
            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "BLOCKED", blockReason: parsed.blockReason })
                    .where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "BLOCKED",
                    message: parsed.blockReason,
                });
            });

            // Notify manager
            if (ticket.building.managerId) {
                await sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "Ticket Blocked",
                    message: `Ticket "${ticket.title}" has been blocked. Reason: ${parsed.blockReason}`,
                    type: "BLOCKED",
                });
            }

        } else if (parsed.action === "COMPLETE") {
            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({
                        status: "DONE",
                        resolutionNotes: parsed.resolutionNotes,
                        resolvedAt: new Date(),
                    })
                    .where(eq(ticketsTable.id, id));

                // Add resolution image
                await tx.insert(ticketImagesTable).values({
                    ticketId: id,
                    url: parsed.imageUrl,
                    uploadedBy: userId,
                    type: "RESOLUTION",
                });

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "COMPLETION_SUBMITTED",
                    message: parsed.resolutionNotes,
                });
            });

            // Notify manager and tenant
            const notifications = [];
            if (ticket.building.managerId) {
                notifications.push(sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "Completion Submitted",
                    message: `Ticket "${ticket.title}" marked complete. Verify and close.`,
                    type: "COMPLETION_SUBMITTED",
                }));
            }
            notifications.push(sendNotification({
                userId: ticket.tenantId,
                ticketId: id,
                title: "Your issue has been resolved",
                message: `Ticket "${ticket.title}" has been marked as resolved. Please rate your experience.`,
                type: "COMPLETION_SUBMITTED",
            }));
            await Promise.allSettled(notifications);

        } else if (parsed.action === "REOPEN") {
            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "REOPENED", completionVerified: false, resolvedAt: null, resolutionNotes: null })
                    .where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id, actorId: userId, action: "REOPENED",
                    message: "Ticket reopened — completion disputed",
                });
            });
        } else if (parsed.action === "UNBLOCK") {
            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "IN_PROGRESS", blockReason: null })
                    .where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id, actorId: userId, action: "UNBLOCKED",
                    message: "Ticket unblocked by manager",
                });
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error.name === "ZodError") {
            return NextResponse.json({ message: error.errors[0].message }, { status: 400 });
        }
        console.error("Status update error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
