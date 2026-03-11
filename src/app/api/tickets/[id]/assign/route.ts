import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, activityLogsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notify";
import { z } from "zod";

const assignSchema = z.object({
    technicianId: z.string().min(1),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "MANAGER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { technicianId } = assignSchema.parse(body);

        // Verify technician exists
        const tech = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, technicianId),
            columns: { id: true, name: true, role: true },
        });

        if (!tech || tech.role !== "TECHNICIAN") {
            return NextResponse.json({ message: "Invalid technician" }, { status: 400 });
        }

        // Fetch ticket to get previous status
        const ticket = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, id),
        });
        if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });

        const userId = session.user.id;

        // Update ticket
        await db.transaction(async (tx) => {
            await tx.update(ticketsTable)
                .set({
                    technicianId,
                    status: "ASSIGNED",
                })
                .where(eq(ticketsTable.id, id));

            await tx.insert(activityLogsTable).values({
                ticketId: id,
                actorId: userId,
                action: ticket.technicianId ? "MISMATCH_ASSIGNED" : "ASSIGNED",
                oldValue: ticket.technicianId ?? undefined,
                newValue: technicianId,
                message: `Assigned to ${tech.name}`,
            });
        });

        // Notify technician
        await sendNotification({
            userId: technicianId,
            ticketId: id,
            title: "New Ticket Assigned",
            message: `You have been assigned ticket: "${ticket.title}" (Unit ${ticket.unitNumber})`,
            type: "TICKET_ASSIGNED",
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error.name === "ZodError") return NextResponse.json({ message: error.errors[0].message }, { status: 400 });
        console.error("Assign error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
