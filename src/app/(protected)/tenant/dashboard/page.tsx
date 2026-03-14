import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Plus, Ticket, ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default async function TenantDashboard() {
    const session = await auth();
    if (!session?.user) return null;

    const tickets = await db.query.ticketsTable.findMany({
        where: eq(ticketsTable.tenantId, session.user.id!),
        orderBy: [desc(ticketsTable.createdAt)],
        with: {
            building: true,
        },
    });

    return (
        <div className="w-full min-w-0 overflow-x-hidden flex flex-col gap-4 p-4 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome & CTA */}
            <section className="space-y-4 min-w-0">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight text-pt-text">
                        Hello, {session.user.name?.split(" ")[0]}
                    </h1>
                    <p className="text-pt-text-dim text-sm">
                        Need help with something in your unit?
                    </p>
                </div>

                <Link href="/tenant/tickets/new">
                    <Button className="w-full h-14 bg-pt-accent hover:bg-pt-accent/90 text-white rounded-xl shadow-lg shadow-pt-accent/20 flex items-center justify-between px-6 group">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-base">Report New Issue</span>
                        </div>
                        <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </section>

            {/* Stats / Active Count */}
            <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-pt-text-muted font-bold">Active Tickets</p>
                    <p className="text-2xl font-bold text-pt-text mt-1">
                        {tickets.filter(t => t.status !== "DONE" && t.status !== "CLOSED_DUPLICATE").length}
                    </p>
                </div>
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-pt-text-muted font-bold">Building</p>
                    <p className="text-sm font-semibold text-pt-text mt-1 truncate">
                        {tickets[0]?.building?.name || "PropTrack Demo"}
                    </p>
                </div>
            </div>

            {/* Ticket List */}
            <section className="space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-pt-text">Recent Requests</h2>
                    <Button variant="link" className="text-pt-accent p-0 h-auto text-xs font-semibold hover:underline">
                        View All
                    </Button>
                </div>

                {tickets.length === 0 ? (
                    <div className="bg-pt-surface border border-pt-border rounded-2xl p-8 text-center">
                        <Ticket className="w-10 h-10 text-pt-text-muted mx-auto mb-3" />
                        <p className="text-pt-text font-medium">No tickets yet</p>
                        <p className="text-sm text-pt-text-muted mt-1">When you report an issue, it will appear here.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 w-full min-w-0">
                        {tickets.map((ticket) => (
                            <Link key={ticket.id} href={`/tenant/tickets/${ticket.id}`} className="block w-full min-w-0">
                                <div className="w-full bg-pt-surface border border-pt-border rounded-2xl p-4 group hover:border-pt-accent/40 transition-colors active:scale-[0.98]">
                                    <div className="flex flex-col gap-3 w-full min-w-0">
                                        <div className="flex items-start justify-between gap-3 min-w-0">
                                            <div className="space-y-1 min-w-0">
                                                <h3 className="font-semibold text-pt-text line-clamp-2 break-words group-hover:text-pt-accent transition-colors">
                                                    {ticket.title}
                                                </h3>
                                                <p className="text-xs text-pt-text-dim line-clamp-2 break-words">
                                                    {ticket.description}
                                                </p>
                                            </div>
                                            <PriorityBadge priority={ticket.priority} className="shrink-0 self-start" />
                                        </div>

                                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-pt-border/30 mt-1 min-w-0">
                                            <StatusBadge status={ticket.status} />
                                            <div className="flex items-center gap-1.5 text-[10px] text-pt-text-muted font-medium shrink-0">
                                                <span className="w-1 h-1 rounded-full bg-pt-border"></span>
                                                {formatDistanceToNow(new Date(ticket.createdAt))} ago
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

