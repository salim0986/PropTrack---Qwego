import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, activityLogsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";
import { z } from "zod";

const assignSchema = z.object({
    technicianId: z.string().min(1),
    // Frontend should pass this when user confirms a mismatch warning
    acknowledgedMismatch: z.boolean().optional().default(false),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "MANAGER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { technicianId, acknowledgedMismatch } = assignSchema.parse(body);

        // Verify technician exists and is active
        const tech = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, technicianId),
            columns: { id: true, name: true, role: true, specialties: true, status: true },
        });

        if (!tech || tech.role !== "TECHNICIAN") {
            return NextResponse.json({ message: "Invalid technician" }, { status: 400 });
        }
        if (tech.status !== "ACTIVE") {
            return NextResponse.json({ message: "This technician's account is not active" }, { status: 400 });
        }

        const ticket = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, id),
        });
        if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });

        if (["DONE", "CLOSED_DUPLICATE"].includes(ticket.status)) {
            return NextResponse.json(
                { message: "Cannot assign a completed ticket. Reopen it first." },
                { status: 400 }
            );
        }

        // Detect real specialty mismatch: does tech's specialties match ticket category?
        const techSpecialties = tech.specialties ?? [];
        const ticketCategory = ticket.category; // e.g. "PLUMBING"
        // Category and Specialty enums overlap (PLUMBING, ELECTRICAL, HVAC, STRUCTURAL) — GENERAL matches anything
        const isMatch = techSpecialties.includes("GENERAL") || techSpecialties.includes(ticketCategory as any);
        const isMismatch = !isMatch && techSpecialties.length > 0;

        // If it's a mismatch and client hasn't explicitly acknowledged it, ask for confirmation
        if (isMismatch && !acknowledgedMismatch) {
            return NextResponse.json(
                {
                    requiresMismatchAck: true,
                    message: `${tech.name}'s specialty is ${techSpecialties.join(", ")}. This ticket is categorized as ${ticketCategory}. Confirm assignment?`,
                    techName: tech.name,
                    techSpecialties,
                    ticketCategory,
                },
                { status: 409 }
            );
        }

        const userId = session.user.id;
        const isReassignment = !!ticket.technicianId;
        const isSameTechnician = ticket.technicianId === technicianId;
        const nextStatus = isSameTechnician ? ticket.status : "ASSIGNED";

        await db.transaction(async (tx) => {
            if (!isSameTechnician) {
                await tx.update(ticketsTable)
                    .set({ technicianId, status: nextStatus })
                    .where(eq(ticketsTable.id, id));
            }

            // Notify previously assigned tech of unassignment
            if (isReassignment && ticket.technicianId !== technicianId) {
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: "UNASSIGNED",
                    oldValue: ticket.technicianId ?? undefined,
                    message: "Previous technician was unassigned",
                });
            }

            if (!isSameTechnician) {
                await tx.insert(activityLogsTable).values({
                    ticketId: id,
                    actorId: userId,
                    action: isMismatch ? "MISMATCH_ASSIGNED" : "ASSIGNED",
                    oldValue: ticket.technicianId ?? undefined,
                    newValue: technicianId,
                    message: isMismatch
                        ? `Manager assigned mismatched technician — acknowledged. ${tech.name} (${techSpecialties.join(", ")}) assigned to ${ticketCategory} ticket.`
                        : `Assigned to ${tech.name}`,
                });
            }
        });

        // Notify newly assigned technician
        if (!isSameTechnician) {
            await sendNotification({
                userId: technicianId,
                ticketId: id,
                title: "New Ticket Assigned 🔧",
                message: `You've been assigned: "${ticket.title}" (Unit ${ticket.unitNumber})`,
                type: "TICKET_ASSIGNED",
            });
        }

        // If reassignment, notify old technician of unassignment
        if (isReassignment && ticket.technicianId && ticket.technicianId !== technicianId) {
            await sendNotification({
                userId: ticket.technicianId,
                ticketId: id,
                title: "Unassigned from Ticket",
                message: `You have been unassigned from "${ticket.title}".`,
                type: "TICKET_UNASSIGNED",
            });
        }

        return NextResponse.json({
            success: true,
            status: nextStatus,
            unchangedAssignment: isSameTechnician,
        });

    } catch (error: any) {
        if (error?.name === "ZodError" || error?.issues) {
            const message = error?.errors?.[0]?.message ?? error?.issues?.[0]?.message ?? "Invalid request";
            return NextResponse.json({ message }, { status: 400 });
        }
        console.error("Assign error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
