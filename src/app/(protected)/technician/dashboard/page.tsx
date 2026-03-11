import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, usersTable } from "@/db/schema";
import { eq, and, or, desc, not, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { AfterHoursBanner } from "@/components/shared/AfterHoursBanner";
import { isAfterHours } from "@/lib/after-hours";
import { Wrench, Clock, CheckCircle2, AlertTriangle, ChevronRight, Zap } from "lucide-react";

export default async function TechnicianDashboard() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const userId = session.user.id;

    // Fetch technician's assigned tickets
    const myTickets = await db.query.ticketsTable.findMany({
        where: and(
            eq(ticketsTable.technicianId, userId),
            not(inArray(ticketsTable.status, ["DONE", "CLOSED_DUPLICATE"]))
        ),
        orderBy: [desc(ticketsTable.updatedAt)],
        with: { building: true, tenant: true },
    });

    // Fetch completed tickets (last 5)
    const completedTickets = await db.query.ticketsTable.findMany({
        where: and(
            eq(ticketsTable.technicianId, userId),
            eq(ticketsTable.status, "DONE")
        ),
        orderBy: [desc(ticketsTable.resolvedAt)],
        limit: 5,
        with: { building: true },
    });

    const afterHours = isAfterHours();
    const blockedCount = myTickets.filter(t => t.status === "BLOCKED").length;
    const inProgressCount = myTickets.filter(t => t.status === "IN_PROGRESS").length;
    const openCount = myTickets.filter(t => t.status === "OPEN" || t.status === "ASSIGNED").length;

    const urgentTickets = myTickets.filter(t => t.priority === "URGENT");

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            {afterHours && <AfterHoursBanner isAfterHours={afterHours} />}

            {/* Header */}
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Good to see you,</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight">
                    {session.user.name?.split(" ")[0]} 👷
                </h1>
            </div>

            {/* Urgent Banner */}
            {urgentTickets.length > 0 && (
                <div className="bg-pt-red/10 border border-pt-red/30 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-pt-red/20 rounded-xl flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-pt-red" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-pt-red">
                            {urgentTickets.length} URGENT ticket{urgentTickets.length > 1 ? "s" : ""} need attention
                        </p>
                        <p className="text-xs text-pt-text-muted mt-0.5">
                            {urgentTickets.map(t => t.title).join(", ")}
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-3 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-pt-yellow/10 rounded-xl flex items-center justify-center">
                        <Clock className="w-4 h-4 text-pt-yellow" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{inProgressCount}</p>
                    <p className="text-[10px] text-pt-text-muted text-center leading-tight">In Progress</p>
                </div>
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-3 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-pt-blue/10 rounded-xl flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-pt-blue" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{openCount}</p>
                    <p className="text-[10px] text-pt-text-muted text-center leading-tight">Assigned</p>
                </div>
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-3 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-pt-red/10 rounded-xl flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-pt-red" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{blockedCount}</p>
                    <p className="text-[10px] text-pt-text-muted text-center leading-tight">Blocked</p>
                </div>
            </div>

            {/* Active Tasks */}
            <section>
                <h2 className="text-sm font-semibold text-pt-text-muted uppercase tracking-wider mb-3">
                    My Active Tasks ({myTickets.length})
                </h2>
                {myTickets.length === 0 ? (
                    <div className="bg-pt-surface border border-pt-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                        <div className="w-14 h-14 bg-pt-green/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-pt-green" />
                        </div>
                        <p className="text-pt-text font-medium">All clear!</p>
                        <p className="text-pt-text-muted text-sm">No active tasks. You're all caught up.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {myTickets.map((ticket) => (
                            <Link
                                key={ticket.id}
                                href={`/technician/tasks/${ticket.id}`}
                                className="bg-pt-surface border border-pt-border rounded-2xl p-4 active:scale-[0.98] transition-transform flex items-start gap-3 group hover:border-pt-accent/40"
                            >
                                {/* Category icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    ticket.priority === "URGENT" ? "bg-pt-red/10" :
                                    ticket.priority === "HIGH" ? "bg-pt-accent/10" :
                                    "bg-pt-blue/10"
                                }`}>
                                    <Wrench className={`w-5 h-5 ${
                                        ticket.priority === "URGENT" ? "text-pt-red" :
                                        ticket.priority === "HIGH" ? "text-pt-accent" :
                                        "text-pt-blue"
                                    }`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-pt-text text-sm truncate">{ticket.title}</p>
                                    <p className="text-xs text-pt-text-muted mt-0.5 truncate">
                                        {ticket.building?.name} · Unit {ticket.unitNumber}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <StatusBadge status={ticket.status} />
                                        <PriorityBadge priority={ticket.priority} />
                                    </div>
                                    {ticket.status === "BLOCKED" && ticket.blockReason && (
                                        <p className="text-xs text-pt-red mt-1.5 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {ticket.blockReason.slice(0, 50)}...
                                        </p>
                                    )}
                                </div>

                                <ChevronRight className="w-4 h-4 text-pt-text-muted group-hover:text-pt-accent transition-colors shrink-0 mt-1" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* Completed Today */}
            {completedTickets.length > 0 && (
                <section>
                    <h2 className="text-sm font-semibold text-pt-text-muted uppercase tracking-wider mb-3">
                        Recently Completed
                    </h2>
                    <div className="flex flex-col gap-2">
                        {completedTickets.slice(0, 3).map((ticket) => (
                            <div
                                key={ticket.id}
                                className="bg-pt-surface/60 border border-pt-border/60 rounded-xl p-3 flex items-center gap-3"
                            >
                                <div className="w-8 h-8 bg-pt-green/10 rounded-lg flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-pt-green" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-pt-text truncate">{ticket.title}</p>
                                    <p className="text-xs text-pt-text-muted">{ticket.building?.name}</p>
                                </div>
                                <StatusBadge status="DONE" showDot={false} />
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
