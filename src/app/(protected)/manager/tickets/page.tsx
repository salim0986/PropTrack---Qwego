import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ticketsTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { ArrowLeft } from "lucide-react";

type FilterType = "all" | "completed" | "unassigned" | "blocked" | "stalled" | "overnight" | "urgent";

export default async function ManagerTicketListPage({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const { filter = "all" } = await searchParams;

    const tickets = await db.query.ticketsTable.findMany({
        orderBy: [desc(ticketsTable.updatedAt)],
        with: {
            building: { columns: { name: true } },
            tenant: { columns: { name: true } },
            technician: { columns: { name: true } },
        },
    });

    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const filtered = tickets.filter(t => {
        if (filter === "unassigned") return t.status === "OPEN" && !t.technicianId;
        if (filter === "blocked") return t.status === "BLOCKED";
        if (filter === "stalled") return t.status === "ASSIGNED" && new Date(t.updatedAt) < fourHoursAgo;
        if (filter === "overnight") return t.submittedAfterHours;
        if (filter === "urgent") return t.priority === "URGENT";
        if (filter === "completed") return ["DONE", "CLOSED_DUPLICATE"].includes(t.status);
        return true;
    });

    const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
        { value: "all", label: "All" },
        { value: "completed", label: "Completed" },
        { value: "unassigned", label: "Unassigned" },
        { value: "blocked", label: "Blocked" },
        { value: "stalled", label: "Stalled" },
        { value: "overnight", label: "After-Hours" },
        { value: "urgent", label: "Urgent" },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-pt-surface/90 backdrop-blur-md border-b border-pt-border px-4 h-14 flex items-center gap-3">
                <Link href="/manager/dashboard" className="w-8 h-8 flex items-center justify-center text-pt-text-dim hover:text-pt-text">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <span className="font-semibold text-pt-text flex-1">Ticket Triage</span>
                <span className="text-xs text-pt-text-muted bg-pt-surface-light px-2 py-1 rounded-full border border-pt-border">
                    {filtered.length} tickets
                </span>
            </header>

            {/* Filter Chips */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-pt-border">
                {FILTER_OPTIONS.map(opt => (
                    <Link
                        key={opt.value}
                        href={`/manager/tickets?filter=${opt.value}`}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            filter === opt.value
                                ? "bg-pt-accent text-white border-pt-accent"
                                : "bg-pt-surface text-pt-text-muted border-pt-border hover:border-pt-accent/40"
                        }`}
                    >
                        {opt.label}
                    </Link>
                ))}
            </div>

            <div className="flex flex-col gap-2 p-4 pb-28">
                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-pt-text-muted">
                        <p className="text-sm">No tickets in this category.</p>
                    </div>
                ) : (
                    filtered.map((ticket) => (
                        <Link
                            key={ticket.id}
                            href={`/manager/tickets/${ticket.id}`}
                            className="bg-pt-surface border border-pt-border rounded-2xl p-4 group hover:border-pt-accent/40 active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <StatusBadge status={ticket.status as any} showDot={false} />
                                        <PriorityBadge priority={ticket.priority as any} />
                                        {ticket.submittedAfterHours && (
                                            <span className="text-[10px] bg-pt-purple/10 text-pt-purple border border-pt-purple/20 rounded-full px-2 py-0.5">After-Hours</span>
                                        )}
                                    </div>
                                    <p className="font-semibold text-sm text-pt-text truncate">{ticket.title}</p>
                                    <p className="text-xs text-pt-text-muted mt-0.5">
                                        {ticket.building?.name} · Unit {ticket.unitNumber}
                                    </p>
                                    <p className="text-xs text-pt-text-muted mt-0.5">
                                        By {ticket.tenant?.name} · {ticket.technician ? `Assigned to ${ticket.technician.name}` : "⚠️ Unassigned"}
                                    </p>
                                </div>
                                <span className="text-xs text-pt-text-muted shrink-0 mt-0.5">
                                    {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                            </div>
                            {ticket.status === "BLOCKED" && ticket.blockReason && (
                                <p className="text-xs text-pt-red mt-2 line-clamp-1 bg-pt-red/5 rounded-lg px-2 py-1">
                                    🔴 {ticket.blockReason}
                                </p>
                            )}
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
