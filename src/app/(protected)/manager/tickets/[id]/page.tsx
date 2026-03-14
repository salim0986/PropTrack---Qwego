"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    ArrowLeft, User, Wrench, CheckCircle2, XCircle, AlertTriangle,
    RefreshCw, Link as LinkIcon, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { cn } from "@/lib/utils";

interface Technician {
    id: string;
    name: string;
    specialties: string[] | null;
}

interface ActivityLog {
    id: string;
    action: string;
    message: string | null;
    createdAt: string;
    actor: { name: string; role: string; };
}

interface DuplicateCandidate {
    id: string;
    title: string;
    status: string;
    unitNumber?: string;
    updatedAt?: string;
}

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
    updatedAt: string;
    technicianId: string | null;
    building: { name: string; address: string; };
    tenant: { name: string; phone: string | null; };
    technician: { name: string; } | null;
    images: { id: string; url: string; type: string; }[];
    activityLogs: ActivityLog[];
}

type ManagerAction = "assign" | "unblock" | "verify" | "dispute" | "close_dup" | "reopen" | null;

export default function ManagerTicketDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [action, setAction] = useState<ManagerAction>(null);
    const [selectedTech, setSelectedTech] = useState<string>("");
    const [disputeNote, setDisputeNote] = useState("");
    const [unblockNote, setUnblockNote] = useState("");
    const [dupTicketId, setDupTicketId] = useState("");
    const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [showImages, setShowImages] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch(`/api/tickets/${id}/detail`).then(r => r.json()),
            fetch("/api/technicians").then(r => r.json()),
            fetch("/api/tickets").then(r => r.json()),
        ]).then(([tkt, techs, allTickets]) => {
            setTicket(tkt);
            setTechnicians(techs);
            setDuplicateCandidates(Array.isArray(allTickets) ? allTickets : []);
            setLoading(false);
        });
    }, [id]);

    async function handleAssign(acknowledgedMismatch = false) {
        if (!selectedTech) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tickets/${id}/assign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ technicianId: selectedTech, acknowledgedMismatch }),
            });

            if (res.status === 409) {
                const data = await res.json();
                if (data.requiresMismatchAck) {
                    toast.warning("Specialty Mismatch", {
                        description: data.message,
                        duration: 10000,
                        action: {
                            label: "Confirm anyway",
                            onClick: () => handleAssign(true),
                        },
                        cancel: {
                            label: "Cancel",
                            onClick: () => {}, // just dismisses
                        },
                    });
                    return; // Stop here, handleAssign will be called again on confirm
                }
            } else if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Assignment failed");
            }

            const data = await res.json();

            toast.success(data.unchangedAssignment ? "Technician unchanged" : "Ticket assigned!");
            const tech = technicians.find(t => t.id === selectedTech);
            setTicket(prev => prev ? {
                ...prev,
                technicianId: selectedTech,
                technician: { name: tech?.name ?? "" },
                status: data.status ?? prev.status,
            } : prev);
            setAction(null);
        } catch (e: any) {
            toast.error(e.message || "Assignment failed");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStatusAction(act: string, extra: Record<string, string> = {}) {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tickets/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: act, ...extra }),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            toast.success("Done");
            router.refresh();
            router.back();
        } catch (e: any) {
            toast.error(e.message || "Failed");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCloseDuplicate() {
        if (!dupTicketId.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/tickets/${id}/close-duplicate`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duplicateOfId: dupTicketId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed to close as duplicate");
            }
            toast.success("Ticket closed as duplicate");
            router.push("/manager/dashboard");
        } catch (e: any) {
            toast.error(e.message || "Failed");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-pt-accent border-t-transparent rounded-full animate-spin" />
        </div>;
    }
    if (!ticket) return null;

    const MATCHED_TECHS = technicians.filter(t =>
        !t.specialties || t.specialties.includes(ticket.category as any)
    );
    const OTHER_TECHS = technicians.filter(t =>
        t.specialties && !t.specialties.includes(ticket.category as any)
    );
    const duplicateOptions = duplicateCandidates
        .filter((t) => t.id !== ticket.id && t.status !== "CLOSED_DUPLICATE")
        .slice(0, 6);
    const canAssign = !["DONE", "CLOSED_DUPLICATE"].includes(ticket.status);
    const selectingSameTech = !!ticket.technicianId && selectedTech === ticket.technicianId;
    const isDialogOpen = action !== null;

    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-pt-surface/90 backdrop-blur-md border-b border-pt-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-pt-text-dim">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-pt-text flex-1 truncate">Manager View</span>
                <StatusBadge status={ticket.status as any} />
            </header>

            <div className="flex flex-col gap-4 p-4 pb-80">

                {/* Ticket Info */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold bg-pt-surface-light border border-pt-border text-pt-text-muted px-2 py-0.5 rounded-full uppercase">{ticket.category}</span>
                        <PriorityBadge priority={ticket.priority as any} />
                    </div>
                    <h1 className="text-xl font-bold text-pt-text">{ticket.title}</h1>
                    <p className="text-sm text-pt-text-muted mt-1">{ticket.building.name} · Unit {ticket.unitNumber}</p>
                </div>

                <p className="text-sm text-pt-text leading-relaxed">{ticket.description}</p>

                {/* Current Technician */}
                <div className={cn("rounded-2xl border p-4", ticket.technicianId ? "bg-pt-surface border-pt-border" : "bg-pt-yellow/10 border-pt-yellow/30")}>
                    <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", ticket.technicianId ? "bg-pt-blue/10" : "bg-pt-yellow/20")}>
                            <Wrench className={cn("w-4 h-4", ticket.technicianId ? "text-pt-blue" : "text-pt-yellow")} />
                        </div>
                        <div>
                            <p className="text-xs text-pt-text-muted">{ticket.technicianId ? "Assigned Technician" : "⚠️ Not Assigned"}</p>
                            <p className="text-sm font-medium text-pt-text">{ticket.technician?.name ?? "No one assigned yet"}</p>
                        </div>
                    </div>
                </div>

                {/* Blocked Reason */}
                {ticket.status === "BLOCKED" && ticket.blockReason && (
                    <div className="bg-pt-red/10 border border-pt-red/30 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-pt-red mb-1 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Block Reason
                        </p>
                        <p className="text-sm text-pt-text-muted">{ticket.blockReason}</p>
                    </div>
                )}

                {/* Resolution Notes (if completed) */}
                {ticket.resolutionNotes && (
                    <div className="bg-pt-green/10 border border-pt-green/30 rounded-2xl p-4">
                        <p className="text-xs font-semibold text-pt-green mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolution Notes
                        </p>
                        <p className="text-sm text-pt-text-muted">{ticket.resolutionNotes}</p>
                    </div>
                )}

                {/* Images */}
                {ticket.images.length > 0 && (
                    <section className="bg-pt-surface border border-pt-border rounded-2xl overflow-hidden">
                        <button onClick={() => setShowImages(!showImages)} className="w-full p-4 flex items-center justify-between">
                            <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Photos ({ticket.images.length})</p>
                            {showImages ? <ChevronUp className="w-4 h-4 text-pt-text-muted" /> : <ChevronDown className="w-4 h-4 text-pt-text-muted" />}
                        </button>
                        <AnimatePresence>
                            {showImages && (
                                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                                        {ticket.images.map(img => (
                                            <div key={img.id} className="relative">
                                                <a href={img.url} target="_blank" rel="noopener noreferrer">
                                                    <img src={img.url} alt={img.type} className="w-full aspect-square object-cover rounded-xl border border-pt-border" />
                                                </a>
                                                <span className={cn(
                                                    "absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                                    img.type === "RESOLUTION" ? "bg-pt-green text-white" : "bg-pt-blue text-white"
                                                )}>{img.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

                {/* Activity Log */}
                <section className="bg-pt-surface border border-pt-border rounded-2xl overflow-hidden">
                    <button onClick={() => setShowLogs(!showLogs)} className="w-full p-4 flex items-center justify-between">
                        <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Activity Log ({ticket.activityLogs.length})</p>
                        {showLogs ? <ChevronUp className="w-4 h-4 text-pt-text-muted" /> : <ChevronDown className="w-4 h-4 text-pt-text-muted" />}
                    </button>
                    <AnimatePresence>
                        {showLogs && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                <div className="flex flex-col gap-0 px-4 pb-4">
                                    {ticket.activityLogs.map((log, i) => (
                                        <div key={log.id} className="flex gap-3 py-2">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2 h-2 rounded-full bg-pt-accent mt-1.5 shrink-0" />
                                                {i < ticket.activityLogs.length - 1 && <div className="w-px flex-1 bg-pt-border mt-1" />}
                                            </div>
                                            <div className="pb-2">
                                                <p className="text-xs font-semibold text-pt-text">{log.action.replace(/_/g, " ")} by {log.actor.name}</p>
                                                {log.message && <p className="text-xs text-pt-text-muted mt-0.5">{log.message}</p>}
                                                <p className="text-[10px] text-pt-text-muted mt-0.5">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

            </div>

            <AnimatePresence>
                {isDialogOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120]"
                    >
                        <button
                            type="button"
                            aria-label="Close action dialog"
                            className="absolute inset-0 bg-black/35"
                            onClick={() => setAction(null)}
                        />

                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[430px] rounded-t-3xl border-x border-t border-pt-border bg-pt-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[86svh] overflow-y-auto shadow-2xl"
                        >
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-pt-border" />

                            {action === "assign" && (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-pt-text">Assign to Technician</p>
                                        <p className="text-xs text-pt-text-muted mt-1">Select a technician to assign this ticket.</p>
                                    </div>

                                    {MATCHED_TECHS.length > 0 && (
                                        <div>
                                            <p className="text-xs text-pt-green font-semibold mb-2">Recommended (Matching Specialty)</p>
                                            <div className="flex flex-col gap-2">
                                                {MATCHED_TECHS.map(t => (
                                                    <button key={t.id} onClick={() => setSelectedTech(t.id)}
                                                        className={cn("text-left px-3 py-2.5 rounded-xl border text-sm transition-all",
                                                            selectedTech === t.id ? "border-pt-accent bg-pt-accent/10 text-pt-accent" : "border-pt-border bg-pt-surface-light text-pt-text hover:border-pt-accent/40"
                                                        )}>
                                                        {t.name}
                                                        {ticket.technicianId === t.id && <span className="text-xs text-pt-text-muted ml-2">(currently assigned)</span>}
                                                        {t.specialties && <span className="text-xs text-pt-text-muted ml-2">({t.specialties.join(", ")})</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {OTHER_TECHS.length > 0 && (
                                        <div>
                                            <p className="text-xs text-pt-text-muted font-semibold mb-2">Other Technicians</p>
                                            <div className="flex flex-col gap-2">
                                                {OTHER_TECHS.map(t => (
                                                    <button key={t.id} onClick={() => setSelectedTech(t.id)}
                                                        className={cn("text-left px-3 py-2.5 rounded-xl border text-sm transition-all",
                                                            selectedTech === t.id ? "border-pt-accent bg-pt-accent/10 text-pt-accent" : "border-pt-border bg-pt-surface-light text-pt-text"
                                                        )}>
                                                        {t.name}
                                                        {ticket.technicianId === t.id && <span className="text-xs text-pt-text-muted ml-2">(currently assigned)</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectingSameTech && (
                                        <p className="text-xs text-pt-text-muted">
                                            This technician is already assigned. Choose a different technician to reassign.
                                        </p>
                                    )}

                                    <div className="flex gap-2 pt-1">
                                        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAction(null)}>Cancel</Button>
                                        <Button onClick={() => handleAssign(false)} disabled={!selectedTech || selectingSameTech || submitting}
                                            className="flex-1 rounded-xl bg-pt-accent hover:bg-pt-accent/90 text-white">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {action === "dispute" && (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-pt-text">Dispute Completion</p>
                                        <p className="text-xs text-pt-text-muted mt-1">Provide a reason to reopen this completed ticket.</p>
                                    </div>

                                    <Textarea value={disputeNote} onChange={e => setDisputeNote(e.target.value)}
                                        placeholder="Describe why this completion is disputed..." rows={3} autoFocus
                                        className="bg-pt-surface-light border-pt-border/60 rounded-xl resize-none text-sm" />

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAction(null)}>Cancel</Button>
                                        <Button onClick={() => handleStatusAction("REOPEN", { reason: disputeNote })} disabled={submitting}
                                            className="flex-1 rounded-xl bg-pt-red hover:bg-pt-red/90 text-white">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Dispute & Reopen"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {action === "unblock" && (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-pt-text">Unblock Ticket</p>
                                        <p className="text-xs text-pt-text-muted mt-1">Add a note explaining how the block is resolved.</p>
                                    </div>

                                    <Textarea value={unblockNote} onChange={e => setUnblockNote(e.target.value)}
                                        placeholder="Describe how the block was resolved..." rows={3} autoFocus
                                        className="bg-pt-surface-light border-pt-border/60 rounded-xl resize-none text-sm" />

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAction(null)}>Cancel</Button>
                                        <Button onClick={() => handleStatusAction("UNBLOCK", { unblockNote })} disabled={submitting || unblockNote.length < 10}
                                            className="flex-1 rounded-xl bg-pt-green hover:bg-pt-green/90 text-white">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Unblock"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {action === "close_dup" && (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-pt-text">Close as Duplicate</p>
                                        <p className="text-xs text-pt-text-muted mt-1">Select the original ticket or paste its ticket ID.</p>
                                    </div>

                                    <input value={dupTicketId} onChange={e => setDupTicketId(e.target.value)}
                                        placeholder="Original Ticket ID..." autoFocus
                                        className="bg-pt-surface-light border border-pt-border/60 rounded-xl px-3 py-2.5 text-sm text-pt-text focus:outline-none focus:ring-2 focus:ring-pt-accent/50" />

                                    {duplicateOptions.length > 0 && (
                                        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                                            {duplicateOptions.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setDupTicketId(opt.id)}
                                                    className={cn(
                                                        "text-left px-3 py-2.5 rounded-xl border text-sm transition-all",
                                                        dupTicketId === opt.id
                                                            ? "border-pt-accent bg-pt-accent/10 text-pt-accent"
                                                            : "border-pt-border bg-pt-surface-light text-pt-text"
                                                    )}
                                                >
                                                    <p className="font-medium truncate">{opt.title}</p>
                                                    <p className="text-[11px] text-pt-text-muted">#{opt.id.slice(0, 8)} · {opt.status}{opt.unitNumber ? ` · Unit ${opt.unitNumber}` : ""}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAction(null)}>Cancel</Button>
                                        <Button onClick={handleCloseDuplicate} disabled={!dupTicketId || submitting}
                                            className="flex-1 rounded-xl bg-pt-surface-light text-pt-text-muted border border-pt-border">
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Close as Duplicate"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Bar */}
            <div className={cn(
                "fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-pt-surface/95 backdrop-blur-md border-t border-pt-border p-4 flex flex-col gap-2 z-40 transition-opacity",
                isDialogOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                {/* Primary Actions */}
                <div className="flex gap-2">
                    {canAssign && (
                        <Button onClick={() => setAction("assign")} variant="outline" disabled={isDialogOpen}
                            className="flex-1 h-12 rounded-xl border-pt-accent/40 text-pt-accent hover:bg-pt-accent/10 font-medium">
                            <User className="w-4 h-4 mr-1.5" />
                            {ticket.technicianId ? "Reassign" : "Assign"}
                        </Button>
                    )}

                    {ticket.status === "BLOCKED" && (
                        <Button onClick={() => setAction("unblock")} disabled={submitting}
                            className="flex-1 h-12 rounded-xl bg-pt-green hover:bg-pt-green/90 text-white font-medium">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1.5" /> Unblock</>}
                        </Button>
                    )}

                    {ticket.status === "DONE" && !ticket.completionVerified && (
                        <Button onClick={() => handleStatusAction("VERIFY_DONE")} disabled={submitting}
                            className="flex-1 h-12 rounded-xl bg-pt-green hover:bg-pt-green/90 text-white font-medium">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Verify & Close
                        </Button>
                    )}
                </div>

                {/* Secondary Actions */}
                <div className="flex gap-2">
                    {ticket.status === "DONE" && (
                        <Button onClick={() => setAction("dispute")} variant="outline" disabled={isDialogOpen}
                            className="flex-1 h-10 rounded-xl border-pt-red/40 text-pt-red hover:bg-pt-red/10 text-sm font-medium">
                            <XCircle className="w-4 h-4 mr-1.5" /> Dispute
                        </Button>
                    )}
                    <Button onClick={() => setAction("close_dup")} variant="outline" disabled={isDialogOpen}
                        className="flex-1 h-10 rounded-xl text-pt-text-muted text-sm font-medium">
                        <LinkIcon className="w-4 h-4 mr-1.5" /> Close as Duplicate
                    </Button>
                </div>
            </div>
        </div>
    );
}
