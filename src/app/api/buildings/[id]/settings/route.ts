import { auth } from "@/lib/auth";
import { db } from "@/db";
import { buildingsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
    businessHoursStart: z.number().int().min(0).max(23).optional(),
    businessHoursEnd: z.number().int().min(1).max(24).optional(),
    businessDays: z.array(z.number().int().min(0).max(6)).optional(),
    emergencyPhone: z.string().optional().nullable(),
});

async function resolveManagerDbId(session: any): Promise<string | null> {
    if (!session?.user?.id || session.user.role !== "MANAGER") return null;

    const byId = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, session.user.id),
        columns: { id: true, role: true },
    });
    if (byId?.role === "MANAGER") return byId.id;

    if (!session.user.email) return null;
    const byEmail = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, session.user.email),
        columns: { id: true, role: true },
    });
    return byEmail?.role === "MANAGER" ? byEmail.id : null;
}

// PATCH /api/buildings/[id]/settings
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        const managerDbId = await resolveManagerDbId(session);
        if (!managerDbId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const building = await db.query.buildingsTable.findFirst({
            where: eq(buildingsTable.id, id),
            columns: { id: true, managerId: true },
        });

        if (!building) return NextResponse.json({ message: "Building not found" }, { status: 404 });

        // Ensure manager is the manager of THIS building
        if (building.managerId !== managerDbId) {
            return NextResponse.json({ message: "You do not manage this building" }, { status: 403 });
        }

        const body = settingsSchema.parse(await req.json());

        await db.update(buildingsTable)
            .set({
                ...(body.businessHoursStart !== undefined && { businessHoursStart: body.businessHoursStart }),
                ...(body.businessHoursEnd !== undefined && { businessHoursEnd: body.businessHoursEnd }),
                ...(body.businessDays !== undefined && { businessDays: body.businessDays }),
                ...(body.emergencyPhone !== undefined && { emergencyPhone: body.emergencyPhone }),
            })
            .where(eq(buildingsTable.id, id));

        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.name === "ZodError") return NextResponse.json({ message: e.errors[0].message }, { status: 400 });
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// GET /api/buildings/[id]/settings
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        const managerDbId = await resolveManagerDbId(session);
        if (!managerDbId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const building = await db.query.buildingsTable.findFirst({
            where: eq(buildingsTable.id, id),
            columns: {
                id: true, name: true, emergencyPhone: true,
                businessHoursStart: true, businessHoursEnd: true, businessDays: true,
            },
        });

        if (!building) return NextResponse.json({ message: "Building not found" }, { status: 404 });

        const owner = await db.query.buildingsTable.findFirst({
            where: eq(buildingsTable.id, id),
            columns: { managerId: true },
        });
        if (!owner || owner.managerId !== managerDbId) {
            return NextResponse.json({ message: "You do not manage this building" }, { status: 403 });
        }

        return NextResponse.json(building);
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
