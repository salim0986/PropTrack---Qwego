import { auth } from "@/lib/auth";
import { db } from "@/db";
import { notificationsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const notifications = await db.query.notificationsTable.findMany({
        where: eq(notificationsTable.userId, session.user.id),
        orderBy: [desc(notificationsTable.createdAt)],
        with: { ticket: { columns: { id: true, title: true } } },
    });

    const role = session.user.role;

    return <NotificationsClient notifications={notifications} role={role} />;
}
