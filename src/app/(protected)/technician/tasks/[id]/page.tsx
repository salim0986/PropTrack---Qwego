"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    ArrowLeft, Wrench, MapPin, Clock, User, AlertTriangle,
    CheckCircle2, XCircle, Navigation, ChevronDown, ChevronUp,
    Image as ImageIcon, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { cn } from "@/lib/utils";

interface TicketDetail {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    unitNumber: string;
    blockReason: string | null;
    resolutionNotes: string | null;
    completionVerified: boolean;
    submittedAfterHours: boolean;
    createdAt: string;
    building: { name: string; address: string; emergencyPhone: string | null; };
    tenant: { name: string; phone: string | null; };
    images: { id: string; url: string; type: string; }[];
}

export default function TechnicianTaskDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [onWayLoading, setOnWayLoading] = useState(false);
    const [showImages, setShowImages] = useState(false);
    const [onWaySent, setOnWaySent] = useState(false);

    useEffect(() => {
        fetch(`/api/tickets/${id}/detail`)
            .then(r => r.json())
            .then(data => { setTicket(data); setLoading(false); })
            .catch(() => { toast.error("Failed to load ticket"); setLoading(false); });
    }, [id]);

    async function handleOnTheWay() {
        setOnWayLoading(true);
        try {
            const res = await fetch(`/api/tickets/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ON_THE_WAY" }),
            });
            if (!res.ok) throw new Error();
            setOnWaySent(true);
            setTicket(prev => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
            toast.success("Status updated!", { description: "Tenant has been notified you're on the way." });
        } catch {
            toast.error("Failed to update status");
        } finally {
            setOnWayLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-pt-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="p-4 text-center text-pt-text-muted">
                <p>Ticket not found.</p>
                <Button onClick={() => router.back()} variant="outline" className="mt-4">Go back</Button>
            </div>
        );
    }

    const canGoOnWay = (ticket.status === "ASSIGNED" || ticket.status === "OPEN") && !onWaySent;
    const canBlock = ticket.status === "IN_PROGRESS" || ticket.status === "ASSIGNED";
    const canComplete = ticket.status === "IN_PROGRESS";

    return (
        <div className="flex flex-col min-h-screen">
            {/* Sticky Header */}
            <header className="sticky top-0 z-50 bg-pt-surface/90 backdrop-blur-md border-b border-pt-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-pt-text-dim hover:text-pt-text">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-pt-text flex-1 truncate">Task Details</span>
                <StatusBadge status={ticket.status as any} />
            </header>

            <div className="flex flex-col gap-4 p-4 pb-32">

                {/* Title and Category */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider bg-pt-surface-light px-2 py-0.5 rounded-full border border-pt-border">
                            {ticket.category}
                        </span>
                        <PriorityBadge priority={ticket.priority as any} />
                    </div>
                    <h1 className="text-xl font-bold text-pt-text mt-2">{ticket.title}</h1>
                </div>

                {/* After Hours Warning */}
                {ticket.submittedAfterHours && (
                    <div className="bg-pt-yellow/10 border border-pt-yellow/30 rounded-xl p-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-pt-yellow shrink-0" />
                        <p className="text-xs text-pt-yellow font-medium">Submitted outside business hours</p>
                    </div>
                )}

                {/* Blocked Warning */}
                {ticket.status === "BLOCKED" && ticket.blockReason && (
                    <div className="bg-pt-red/10 border border-pt-red/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-pt-red" />
                            <p className="text-sm font-semibold text-pt-red">Ticket Blocked</p>
                        </div>
                        <p className="text-sm text-pt-text-muted">{ticket.blockReason}</p>
                    </div>
                )}

                {/* Description */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <h2 className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider mb-2">Description</h2>
                    <p className="text-sm text-pt-text leading-relaxed">{ticket.description}</p>
                </section>

                {/* Location */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <h2 className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider mb-3">Location</h2>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-pt-accent shrink-0" />
                            <p className="text-sm text-pt-text">{ticket.building.name} — Unit {ticket.unitNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-pt-text-muted shrink-0" />
                            <p className="text-sm text-pt-text-muted">{ticket.building.address}</p>
                        </div>
                        {ticket.building.emergencyPhone && (
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-pt-red shrink-0" />
                                <a href={`tel:${ticket.building.emergencyPhone}`} className="text-sm text-pt-red underline">
                                    Emergency: {ticket.building.emergencyPhone}
                                </a>
                            </div>
                        )}
                    </div>
                </section>

                {/* Reported By */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl p-4">
                    <h2 className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider mb-3">Reported By</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-pt-accent/10 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-pt-accent" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-pt-text">{ticket.tenant.name}</p>
                            {ticket.tenant.phone && (
                                <a href={`tel:${ticket.tenant.phone}`} className="text-xs text-pt-accent underline">{ticket.tenant.phone}</a>
                            )}
                        </div>
                    </div>
                </section>

                {/* Photos */}
                {ticket.images.length > 0 && (
                    <section className="bg-pt-surface border border-pt-border rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setShowImages(!showImages)}
                            className="w-full p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-pt-text-muted" />
                                <h2 className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">
                                    Photos ({ticket.images.length})
                                </h2>
                            </div>
                            {showImages ? <ChevronUp className="w-4 h-4 text-pt-text-muted" /> : <ChevronDown className="w-4 h-4 text-pt-text-muted" />}
                        </button>
                        <AnimatePresence>
                            {showImages && (
                                <motion.div
                                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                                        {ticket.images.map(img => (
                                            <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                                                <img src={img.url} alt="Issue" className="w-full aspect-square object-cover rounded-xl border border-pt-border" />
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

                {/* Submitted Info */}
                <div className="flex items-center gap-2 text-xs text-pt-text-muted px-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Submitted {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-pt-surface/95 backdrop-blur-md border-t border-pt-border p-4 pb-safe flex flex-col gap-2">
                {/* On My Way */}
                {canGoOnWay && (
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleOnTheWay}
                        disabled={onWayLoading}
                        className={cn(
                            "w-full h-14 bg-pt-accent hover:bg-pt-accent/90 text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-pt-accent/30 transition-all",
                            onWayLoading && "opacity-70"
                        )}
                    >
                        {onWayLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Navigation className="w-5 h-5" />
                                On My Way
                            </>
                        )}
                    </motion.button>
                )}

                {onWaySent && (
                    <div className="bg-pt-green/10 border border-pt-green/30 rounded-xl p-3 flex items-center gap-2 justify-center">
                        <CheckCircle2 className="w-4 h-4 text-pt-green" />
                        <p className="text-sm text-pt-green font-medium">Tenant notified — you're on the way!</p>
                    </div>
                )}

                {/* Block and Complete */}
                <div className="flex gap-2">
                    {canBlock && (
                        <Button
                            variant="outline"
                            className="flex-1 h-12 border-pt-red/40 text-pt-red hover:bg-pt-red/10 rounded-xl font-medium"
                            onClick={() => router.push(`/technician/tasks/${id}/block`)}
                        >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Block
                        </Button>
                    )}
                    {canComplete && (
                        <Button
                            className="flex-1 h-12 bg-pt-green hover:bg-pt-green/90 text-white rounded-xl font-medium"
                            onClick={() => router.push(`/technician/tasks/${id}/complete`)}
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Complete
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
