import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const ticket = await db.query.ticketsTable.findFirst({
            where: eq(ticketsTable.id, id),
            with: {
                building: { columns: { name: true, address: true, emergencyPhone: true, managerId: true } },
                tenant: { columns: { name: true, phone: true } },
                images: { columns: { id: true, url: true, type: true } },
                activityLogs: {
                    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
                    with: { actor: { columns: { name: true, role: true } } },
                },
            },
        });

        if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });

        return NextResponse.json(ticket);
    } catch (e) {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
