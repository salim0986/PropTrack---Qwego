import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
    ticketsTable, ticketImagesTable, activityLogsTable
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";
import { z } from "zod";

const statusUpdateSchema = z.discriminatedUnion("action", [
    // Technician: on the way (idempotent)
    z.object({ action: z.literal("ON_THE_WAY") }),

    // Technician: start the job → IN_PROGRESS
    z.object({ action: z.literal("START") }),

    // Technician: mark blocked (mandatory reason)
    z.object({ action: z.literal("BLOCK"), blockReason: z.string().min(5, "Please provide a block reason") }),

    // Technician: complete with mandatory proof (1-3 photos, 20+ char note)
    z.object({
        action: z.literal("COMPLETE"),
        resolutionNotes: z.string().min(20, "Resolution notes must be at least 20 characters"),
        imageUrls: z
            .array(z.string().url("Each item must be a valid URL"))
            .min(1, "At least 1 resolution photo is required")
            .max(3, "Maximum of 3 resolution photos"),
    }),

    // Manager: reopen DONE ticket (mandatory reason - Rule 12)
    z.object({
        action: z.literal("REOPEN"),
        reason: z.string().min(10, "Please provide a detailed reason for reopening"),
    }),

    // Manager: verify completed work (closes review loop while keeping DONE state)
    z.object({ action: z.literal("VERIFY_DONE") }),

    // Technician: unblock (mandatory note - Rule 12)
    z.object({
        action: z.literal("UNBLOCK"),
        unblockNote: z.string().min(10, "Please describe how the block was resolved"),
    }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const userId = session.user.id;
        const role = session.user.role;
        const body = await req.json();
        const parsed = statusUpdateSchema.parse(body);

        const ticket = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, id),
            with: {
                building: { columns: { managerId: true, name: true } },
                tenant: { columns: { name: true, id: true } },
                technician: { columns: { name: true } },
            },
        });

        if (!ticket) return NextResponse.json({ message: "Ticket not found" }, { status: 404 });

        const isAssignedTech = ticket.technicianId === userId;
        const isManager = role === "MANAGER";

        // ── ON_THE_WAY ──────────────────────────────────────────────────────────
        if (parsed.action === "ON_THE_WAY") {
            if (!isAssignedTech) {
                return NextResponse.json({ message: "Only the assigned technician can do this" }, { status: 403 });
            }

            const shouldMoveToInProgress = ["ASSIGNED", "REOPENED"].includes(ticket.status);

            // Idempotency check: look for an existing ON_THE_WAY activity on this ticket
            const recentOnWay = await db.query.activityLogsTable.findFirst({
                where: and(
                    eq(activityLogsTable.ticketId, id),
                    eq(activityLogsTable.actorId, userId),
                    eq(activityLogsTable.action, "ON_THE_WAY")
                ),
            });

            if (recentOnWay) {
                // Backfill status for tickets created before ON_THE_WAY started transitioning status.
                if (shouldMoveToInProgress) {
                    await db.update(ticketsTable)
                        .set({ status: "IN_PROGRESS" })
                        .where(eq(ticketsTable.id, id));
                    return NextResponse.json({ success: true, alreadySent: true, statusUpdated: true });
                }

                return NextResponse.json({ success: true, alreadySent: true });
            }

            await db.transaction(async (tx) => {
                // ON_THE_WAY is treated as work start in the mobile flow.
                if (shouldMoveToInProgress) {
                    await tx.update(ticketsTable)
                        .set({ status: "IN_PROGRESS" })
                        .where(eq(ticketsTable.id, id));
                }

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "ON_THE_WAY",
                    oldValue: ticket.status,
                    newValue: shouldMoveToInProgress ? "IN_PROGRESS" : ticket.status,
                    message: "Technician is on the way to the unit",
                });
            });

            await sendNotification({
                userId: ticket.tenantId,
                ticketId: id,
                title: "Technician On The Way 🚗",
                message: `${ticket.technician?.name || "Your technician"} is heading to Unit ${ticket.unitNumber}. Please be available.`,
                type: "ON_THE_WAY",
            });
        }

        // ── START ────────────────────────────────────────────────────────────────
        else if (parsed.action === "START") {
            if (!isAssignedTech) {
                return NextResponse.json({ message: "Only the assigned technician can start this job" }, { status: 403 });
            }
            if (!["ASSIGNED", "REOPENED"].includes(ticket.status)) {
                return NextResponse.json({ message: "Ticket is not in a startable state" }, { status: 400 });
            }

            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "IN_PROGRESS" })
                    .where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "STATUS_CHANGED",
                    oldValue: ticket.status,
                    newValue: "IN_PROGRESS",
                    message: "Technician started work on the ticket",
                });
            });

            // Notify tenant and manager
            await Promise.allSettled([
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Work Started",
                    message: `${ticket.technician?.name || "A technician"} has started working on "${ticket.title}".`,
                    type: "STATUS_CHANGED",
                }),
                ticket.building.managerId && sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "Job In Progress",
                    message: `"${ticket.title}" is now IN_PROGRESS.`,
                    type: "STATUS_CHANGED",
                }),
            ]);
        }

        // ── BLOCK ────────────────────────────────────────────────────────────────
        else if (parsed.action === "BLOCK") {
            if (!isAssignedTech) {
                return NextResponse.json({ message: "Only the assigned technician can mark a block" }, { status: 403 });
            }
            if (!["IN_PROGRESS", "ASSIGNED"].includes(ticket.status)) {
                return NextResponse.json({ message: "Can only block tickets that are in progress or assigned" }, { status: 400 });
            }

            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "BLOCKED", blockReason: parsed.blockReason })
                    .where(eq(ticketsTable.id, id));
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "BLOCKED",
                    oldValue: ticket.status,
                    newValue: "BLOCKED",
                    message: parsed.blockReason,
                });
            });

            await Promise.allSettled([
                ticket.building.managerId && sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "⚠️ Ticket Blocked",
                    message: `"${ticket.title}" is on hold — ${parsed.blockReason}`,
                    type: "BLOCKED",
                }),
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Work Paused",
                    message: `Your ticket "${ticket.title}" is temporarily on hold: ${parsed.blockReason}`,
                    type: "BLOCKED",
                }),
            ]);
        }

        // ── COMPLETE ─────────────────────────────────────────────────────────────
        else if (parsed.action === "COMPLETE") {
            if (!isAssignedTech) {
                return NextResponse.json({ message: "Only the assigned technician can complete this ticket" }, { status: 403 });
            }
            if (ticket.status !== "IN_PROGRESS") {
                return NextResponse.json({ message: "Can only complete tickets that are IN_PROGRESS" }, { status: 400 });
            }

            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({
                        status: "DONE",
                        resolutionNotes: parsed.resolutionNotes,
                        resolvedAt: new Date(),
                        completionVerified: false,  // pending manager review; manager opens/disputes to reject
                    })
                    .where(eq(ticketsTable.id, id));

                // Insert resolution images only when provided (values([]) would break in SQL)
                if (parsed.imageUrls.length > 0) {
                    await tx.insert(ticketImagesTable).values(
                        parsed.imageUrls.map((url: string) => ({
                            ticketId: id,
                            url,
                            uploadedBy: userId,
                            type: "RESOLUTION" as const,
                        }))
                    );
                }

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "COMPLETION_SUBMITTED",
                    oldValue: "IN_PROGRESS",
                    newValue: "DONE",
                    message: parsed.resolutionNotes,
                });
            });

            // Notify manager and tenant
            await Promise.allSettled([
                ticket.building.managerId && sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "✅ Job Completed",
                    message: `"${ticket.title}" has been marked complete by ${ticket.technician?.name || "technician"}.`,
                    type: "COMPLETION_SUBMITTED",
                }),
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Issue Resolved ✅",
                    message: `Your ticket "${ticket.title}" has been marked as resolved. Please rate your experience.`,
                    type: "COMPLETION_SUBMITTED",
                }),
            ]);
        }

        // ── VERIFY_DONE ──────────────────────────────────────────────────────────
        else if (parsed.action === "VERIFY_DONE") {
            if (!isManager) {
                return NextResponse.json({ message: "Only managers can verify completion" }, { status: 403 });
            }
            if (ticket.status !== "DONE") {
                return NextResponse.json({ message: "Only DONE tickets can be verified" }, { status: 400 });
            }

            if (ticket.completionVerified) {
                return NextResponse.json({ success: true, alreadyVerified: true });
            }

            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ completionVerified: true })
                    .where(eq(ticketsTable.id, id));

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "STATUS_CHANGED",
                    oldValue: "DONE",
                    newValue: "DONE",
                    message: "Manager verified completion and closed review",
                });
            });

            await Promise.allSettled([
                ticket.technicianId && sendNotification({
                    userId: ticket.technicianId,
                    ticketId: id,
                    title: "Completion Verified ✅",
                    message: `Manager verified your completion for "${ticket.title}".`,
                    type: "STATUS_CHANGED",
                }),
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Ticket Closed ✅",
                    message: `Your ticket "${ticket.title}" has been verified and closed by the manager.`,
                    type: "STATUS_CHANGED",
                }),
            ]);
        }

        // ── REOPEN ───────────────────────────────────────────────────────────────
        else if (parsed.action === "REOPEN") {
            if (!isManager) {
                return NextResponse.json({ message: "Only managers can reopen tickets" }, { status: 403 });
            }
            if (ticket.status !== "DONE") {
                return NextResponse.json({ message: "Only DONE tickets can be reopened" }, { status: 400 });
            }

            await db.transaction(async (tx) => {
                // Void the completion record
                await tx.update(ticketsTable)
                    .set({
                        status: "REOPENED",
                        completionVerified: false,
                        resolvedAt: null,
                        resolutionNotes: null,
                    })
                    .where(eq(ticketsTable.id, id));

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "REOPENED",
                    oldValue: "DONE",
                    newValue: "REOPENED",
                    message: `Reopened: ${parsed.reason}`,
                });
            });

            // Notify technician and tenant
            await Promise.allSettled([
                ticket.technicianId && sendNotification({
                    userId: ticket.technicianId,
                    ticketId: id,
                    title: "⚠️ Completion Disputed",
                    message: `Your completion for "${ticket.title}" was disputed. Reason: ${parsed.reason}`,
                    type: "COMPLETION_DISPUTED",
                }),
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Ticket Reopened",
                    message: `Your ticket "${ticket.title}" has been reopened for further review.`,
                    type: "COMPLETION_DISPUTED",
                }),
            ]);
        }

        // ── UNBLOCK ──────────────────────────────────────────────────────────────
        else if (parsed.action === "UNBLOCK") {
            if (!isAssignedTech && !isManager) {
                return NextResponse.json({ message: "Not authorized to unblock this ticket" }, { status: 403 });
            }
            if (ticket.status !== "BLOCKED") {
                return NextResponse.json({ message: "Ticket is not currently blocked" }, { status: 400 });
            }

            await db.transaction(async (tx) => {
                await tx.update(ticketsTable)
                    .set({ status: "IN_PROGRESS", blockReason: null })
                    .where(eq(ticketsTable.id, id));

                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "UNBLOCKED",
                    oldValue: "BLOCKED",
                    newValue: "IN_PROGRESS",
                    message: `Block resolved: ${parsed.unblockNote}`,
                });
            });

            await Promise.allSettled([
                ticket.building.managerId && sendNotification({
                    userId: ticket.building.managerId,
                    ticketId: id,
                    title: "Block Resolved",
                    message: `Work has resumed on "${ticket.title}". ${parsed.unblockNote}`,
                    type: "UNBLOCKED",
                }),
                sendNotification({
                    userId: ticket.tenantId,
                    ticketId: id,
                    title: "Work Resumed",
                    message: `Work has resumed on "${ticket.title}".`,
                    type: "UNBLOCKED",
                }),
            ]);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error?.name === "ZodError" || error?.issues) {
            const message = error?.errors?.[0]?.message ?? error?.issues?.[0]?.message ?? "Invalid request data";
            return NextResponse.json({ message }, { status: 400 });
        }
        console.error("Status update error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
