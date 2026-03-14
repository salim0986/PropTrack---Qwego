import { auth } from "@/lib/auth";
import { db } from "@/db";
import { buildingsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/buildings — public endpoint for building picker on registration
// GET /api/buildings?mine=1 — manager-only: returns their buildings with full settings
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        if (searchParams.get("mine") === "1") {
            const session = await auth();
            if (!session?.user?.id || session.user.role !== "MANAGER") {
                return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
            }
            let managerDbId = session.user.id;

            let buildings = await db.query.buildingsTable.findMany({
                where: eq(buildingsTable.managerId, managerDbId),
                columns: {
                    id: true, name: true, address: true, emergencyPhone: true,
                    businessHoursStart: true, businessHoursEnd: true, businessDays: true,
                },
                orderBy: (b, { asc }) => [asc(b.name)],
            });

            // Fallback for environments where session.user.id is not the DB user id.
            if (buildings.length === 0 && session.user.email) {
                const managerUser = await db.query.usersTable.findFirst({
                    where: eq(usersTable.email, session.user.email),
                    columns: { id: true, role: true },
                });

                if (managerUser?.role === "MANAGER") {
                    managerDbId = managerUser.id;
                    buildings = await db.query.buildingsTable.findMany({
                        where: eq(buildingsTable.managerId, managerDbId),
                        columns: {
                            id: true, name: true, address: true, emergencyPhone: true,
                            businessHoursStart: true, businessHoursEnd: true, businessDays: true,
                        },
                        orderBy: (b, { asc }) => [asc(b.name)],
                    });
                }
            }

            return NextResponse.json(buildings);
        }

        // Public: registration building picker
        const buildings = await db.query.buildingsTable.findMany({
            columns: { id: true, name: true, address: true },
            orderBy: (b, { asc }) => [asc(b.name)],
        });
        return NextResponse.json(buildings);
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
