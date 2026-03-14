import { auth } from "@/lib/auth";
import { db } from "@/db";
import { buildingsTable, escalationRulesTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const ruleSchema = z.object({
    ruleName: z.string().min(1),
    triggerHours: z.number().int().min(1),
    action: z.string().min(1),
    enabled: z.boolean().default(true),
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

// GET /api/buildings/[id]/escalation-rules
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
            columns: { managerId: true },
        });
        if (!building || building.managerId !== managerDbId) {
            return NextResponse.json({ message: "Not authorized for this building" }, { status: 403 });
        }

        const rules = await db.query.escalationRulesTable.findMany({
            where: eq(escalationRulesTable.buildingId, id),
            orderBy: (r, { asc }) => [asc(r.triggerHours)],
        });

        return NextResponse.json(rules);
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PATCH /api/buildings/[id]/escalation-rules — upsert all rules for a building
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
            columns: { managerId: true },
        });
        if (!building || building.managerId !== managerDbId) {
            return NextResponse.json({ message: "Not authorized for this building" }, { status: 403 });
        }

        const body = z.array(ruleSchema).parse(await req.json());

        // Replace all rules: delete existing, insert new ones
        await db.transaction(async (tx) => {
            await tx.delete(escalationRulesTable)
                .where(eq(escalationRulesTable.buildingId, id));

            if (body.length > 0) {
                await tx.insert(escalationRulesTable).values(
                    body.map((rule) => ({
                        buildingId: id,
                        ruleName: rule.ruleName,
                        triggerHours: rule.triggerHours,
                        action: rule.action,
                        enabled: rule.enabled,
                    }))
                );
            }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.name === "ZodError") return NextResponse.json({ message: e.errors[0].message }, { status: 400 });
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
