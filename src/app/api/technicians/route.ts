import { auth } from "@/lib/auth";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

// Returns all technicians — optionally those in the same building as the manager
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const technicians = await db.query.usersTable.findMany({
            where: eq(usersTable.role, "TECHNICIAN"),
            columns: { id: true, name: true, specialties: true, phone: true, status: true },
        });

        return NextResponse.json(technicians);
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
