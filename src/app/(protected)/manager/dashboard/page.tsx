import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable, usersTable } from "@/db/schema";
import { eq, and, or, desc, inArray, not } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { AfterHoursBanner } from "@/components/shared/AfterHoursBanner";
import { isAfterHours } from "@/lib/after-hours";
import {
    LayoutDashboard, AlertTriangle, Clock, CheckCircle2,
    ChevronRight, Moon, Flame, XCircle, Users, TrendingUp
} from "lucide-react";

export default async function ManagerDashboard() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const userId = session.user.id;

    // Get the manager's buildings
    const manager = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
        with: { managedBuildings: true },
    });

    const buildingIds = manager?.managedBuildings?.map(b => b.id) ?? [];

    // All open tickets for managed buildings
    const allTickets = buildingIds.length > 0 ? await db.query.ticketsTable.findMany({
        where: and(
            inArray(ticketsTable.buildingId, buildingIds),
            not(inArray(ticketsTable.status, ["DONE", "CLOSED_DUPLICATE"]))
        ),
        orderBy: [desc(ticketsTable.updatedAt)],
        with: {
            building: { columns: { name: true } },
            tenant: { columns: { name: true } },
            technician: { columns: { name: true } },
        },
    }) : [];

    // Categorize tickets for triage
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stalledTickets = allTickets.filter(t =>
        t.status === "ASSIGNED" && new Date(t.updatedAt) < fourHoursAgo
    );
    const blockedTickets = allTickets.filter(t => t.status === "BLOCKED");
    const overnightTickets = allTickets.filter(t => t.submittedAfterHours);
    const urgentTickets = allTickets.filter(t => t.priority === "URGENT");
    const unassignedTickets = allTickets.filter(t => t.status === "OPEN" && !t.technicianId);

    const afterHours = isAfterHours();

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            {afterHours && <AfterHoursBanner isAfterHours={afterHours} />}

            {/* Header */}
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Manager Overview</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight">
                    {session.user.name?.split(" ")[0]}&apos;s Hub 🏢
                </h1>
            </div>

            {/* Alert Banners — Stacked Priority */}
            {urgentTickets.length > 0 && (
                <div className="bg-pt-red/10 border border-pt-red/30 rounded-2xl p-4 flex items-start gap-3">
                    <Flame className="w-5 h-5 text-pt-red shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-pt-red">{urgentTickets.length} URGENT tickets need immediate attention</p>
                        <div className="flex flex-col gap-1 mt-2">
                            {urgentTickets.slice(0, 2).map(t => (
                                <Link key={t.id} href={`/manager/tickets/${t.id}`}
                                    className="text-xs text-pt-text-muted hover:text-pt-red flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3 shrink-0" /> {t.title} — {t.building?.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {blockedTickets.length > 0 && (
                <div className="bg-pt-yellow/10 border border-pt-yellow/30 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-pt-yellow shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-pt-yellow">{blockedTickets.length} tickets blocked</p>
                        <p className="text-xs text-pt-text-muted mt-0.5">Action required to unblock</p>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/manager/tickets?filter=all" className="bg-pt-surface border border-pt-border rounded-2xl p-4 flex flex-col gap-2 hover:border-pt-accent/40 transition-colors">
                    <div className="w-9 h-9 bg-pt-blue/10 rounded-xl flex items-center justify-center">
                        <LayoutDashboard className="w-4 h-4 text-pt-blue" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{allTickets.length}</p>
                    <p className="text-xs text-pt-text-muted">Total Active</p>
                </Link>

                <Link href="/manager/tickets?filter=unassigned" className="bg-pt-surface border border-pt-border rounded-2xl p-4 flex flex-col gap-2 hover:border-pt-accent/40 transition-colors">
                    <div className="w-9 h-9 bg-pt-accent/10 rounded-xl flex items-center justify-center">
                        <Users className="w-4 h-4 text-pt-accent" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{unassignedTickets.length}</p>
                    <p className="text-xs text-pt-text-muted">Need Assignment</p>
                </Link>

                <Link href="/manager/tickets?filter=stalled" className="bg-pt-surface border border-pt-border rounded-2xl p-4 flex flex-col gap-2 hover:border-pt-accent/40 transition-colors">
                    <div className="w-9 h-9 bg-pt-yellow/10 rounded-xl flex items-center justify-center">
                        <Clock className="w-4 h-4 text-pt-yellow" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{stalledTickets.length}</p>
                    <p className="text-xs text-pt-text-muted">Stalled &gt;4h</p>
                </Link>

                <Link href="/manager/tickets?filter=overnight" className="bg-pt-surface border border-pt-border rounded-2xl p-4 flex flex-col gap-2 hover:border-pt-accent/40 transition-colors">
                    <div className="w-9 h-9 bg-pt-purple/10 rounded-xl flex items-center justify-center">
                        <Moon className="w-4 h-4 text-pt-purple" />
                    </div>
                    <p className="text-2xl font-bold text-pt-text">{overnightTickets.length}</p>
                    <p className="text-xs text-pt-text-muted">After-Hours</p>
                </Link>
            </div>

            {/* All Tickets Feed */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-pt-text-muted uppercase tracking-wider">
                        Live Ticket Feed
                    </h2>
                    <Link href="/manager/tickets" className="text-xs text-pt-accent hover:underline">
                        See all
                    </Link>
                </div>

                {allTickets.length === 0 ? (
                    <div className="bg-pt-surface border border-pt-border rounded-2xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-pt-green mx-auto mb-3" />
                        <p className="text-pt-text font-medium">All clear!</p>
                        <p className="text-sm text-pt-text-muted mt-1">No open tickets across your buildings.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {allTickets.slice(0, 8).map((ticket) => (
                            <Link
                                key={ticket.id}
                                href={`/manager/tickets/${ticket.id}`}
                                className="bg-pt-surface border border-pt-border rounded-xl p-3.5 flex items-start gap-3 group hover:border-pt-accent/40 transition-colors active:scale-[0.98]"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <StatusBadge status={ticket.status as any} showDot={false} />
                                        {ticket.priority === "URGENT" && (
                                            <span className="text-[10px] bg-pt-red/10 text-pt-red border border-pt-red/20 rounded-full px-2 py-0.5 font-semibold">URGENT</span>
                                        )}
                                    </div>
                                    <p className="font-medium text-sm text-pt-text mt-1.5 truncate">{ticket.title}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <p className="text-xs text-pt-text-muted truncate">
                                            {ticket.building?.name} · Unit {ticket.unitNumber}
                                            {ticket.technician ? ` · ${ticket.technician.name}` : " · Unassigned"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-pt-text-muted group-hover:text-pt-accent transition-colors shrink-0 mt-1" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
