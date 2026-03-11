import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, activityLogsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ duplicateOfId: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "MANAGER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { duplicateOfId } = schema.parse(await req.json());

        // Verify original exists
        const original = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, duplicateOfId),
        });
        if (!original) return NextResponse.json({ message: "Original ticket not found" }, { status: 404 });

        await db.transaction(async (tx) => {
            await tx.update(ticketsTable)
                .set({ status: "CLOSED_DUPLICATE", duplicateOfId })
                .where(eq(ticketsTable.id, id));

            await tx.insert(activityLogsTable).values({
                ticketId: id,
                actorId: session.user.id!,
                action: "CLOSED_DUPLICATE",
                message: `Closed as duplicate of #${duplicateOfId}`,
                newValue: duplicateOfId,
            });
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.name === "ZodError") return NextResponse.json({ message: e.errors[0].message }, { status: 400 });
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
