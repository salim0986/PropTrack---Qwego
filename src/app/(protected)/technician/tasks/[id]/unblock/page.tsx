import { db } from "@/db";
import { ticketsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { UnblockForm } from "./UnblockForm";
import { auth } from "@/lib/auth";

export default async function TechnicianUnblockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: ticketId } = await params;
    const session = await auth();
    if (!session?.user || session.user.role !== "TECHNICIAN") redirect("/login");

    if (!ticketId) notFound();

    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));

    if (!ticket) notFound();
    if (ticket.status !== "BLOCKED") redirect(`/technician/tasks/${ticketId}`);
    if (ticket.technicianId !== session.user.id) redirect("/technician/dashboard");

    return (
        <div className="min-h-screen bg-pt-surface pb-safe">
            <UnblockForm ticketId={ticket.id} />
        </div>
    );
}
