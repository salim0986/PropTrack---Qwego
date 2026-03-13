"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegistrationRequest {
    id: string;
    requestedAt: Date;
    user: {
        id: string;
        name: string;
        email: string;
        phone?: string | null;
        specialties?: string[] | null;
        createdAt: Date;
    };
}

export function ManagerRegistrationsClient({ initialRequests }: { initialRequests: RegistrationRequest[] }) {
    const [requests, setRequests] = useState(initialRequests);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    async function handleApprove(id: string) {
        setProcessing(id);
        try {
            const res = await fetch(`/api/registrations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
            });
            if (!res.ok) throw new Error();
            setRequests((prev) => prev.filter((r) => r.id !== id));
            toast.success("Technician approved!", { description: "They can now log in." });
        } catch {
            toast.error("Failed to approve registration");
        } finally {
            setProcessing(null);
        }
    }

    async function handleReject(id: string) {
        if (!rejectReason.trim()) {
            toast.error("Please provide a rejection reason");
            return;
        }
        setProcessing(id);
        try {
            const res = await fetch(`/api/registrations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject", reason: rejectReason }),
            });
            if (!res.ok) throw new Error();
            setRequests((prev) => prev.filter((r) => r.id !== id));
            setRejectModal(null);
            setRejectReason("");
            toast.success("Registration rejected");
        } catch {
            toast.error("Failed to reject registration");
        } finally {
            setProcessing(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Manager</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight">Technician Approvals</h1>
            </div>

            {requests.length === 0 ? (
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-pt-green mx-auto mb-3" />
                    <p className="text-pt-text font-medium">All clear!</p>
                    <p className="text-sm text-pt-text-muted mt-1">No pending technician registrations.</p>
                </div>
            ) : (
                <>
                    <div className="bg-pt-purple/10 border border-pt-purple/30 rounded-xl px-4 py-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-pt-purple shrink-0" />
                        <p className="text-sm text-pt-purple font-medium">
                            {requests.length} pending technician {requests.length === 1 ? "application" : "applications"}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        {requests.map((req) => (
                            <motion.div
                                key={req.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-pt-surface border border-pt-border rounded-2xl p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-pt-blue/10 rounded-xl flex items-center justify-center shrink-0">
                                        <Wrench className="w-5 h-5 text-pt-accent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-pt-text">{req.user.name}</p>
                                        <p className="text-xs text-pt-text-muted">{req.user.email}</p>
                                        {req.user.specialties && req.user.specialties.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {req.user.specialties.map((s) => (
                                                    <span
                                                        key={s}
                                                        className="text-[10px] bg-pt-accent/10 text-pt-accent border border-pt-accent/20 rounded-full px-2 py-0.5 font-medium"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[11px] text-pt-text-muted mt-1.5">
                                            Applied {new Date(req.requestedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        className="flex-1 h-10 bg-pt-green hover:bg-pt-green/90 text-white rounded-xl text-sm font-medium"
                                        disabled={processing === req.id}
                                        onClick={() => handleApprove(req.id)}
                                    >
                                        {processing === req.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                Approve
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-10 border-pt-red/40 text-pt-red hover:bg-pt-red/10 rounded-xl text-sm font-medium"
                                        disabled={processing === req.id}
                                        onClick={() => setRejectModal({ id: req.id, name: req.user.name })}
                                    >
                                        <XCircle className="w-4 h-4 mr-1.5" />
                                        Reject
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {/* Reject Modal */}
            <AnimatePresence>
                {rejectModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center p-4"
                        onClick={() => setRejectModal(null)}
                    >
                        <motion.div
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 60, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-pt-surface border border-pt-border rounded-2xl p-5 w-full max-w-sm"
                        >
                            <h2 className="text-base font-bold text-pt-text mb-1">
                                Reject {rejectModal.name}?
                            </h2>
                            <p className="text-sm text-pt-text-muted mb-4">
                                Please provide a reason. The technician will be notified.
                            </p>
                            <textarea
                                className="w-full bg-pt-surface-light border border-pt-border rounded-xl p-3 text-sm text-pt-text resize-none h-24 focus:outline-none focus:ring-1 focus:ring-pt-accent mb-4"
                                placeholder="e.g. Not qualified for current vacancies..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-10 rounded-xl text-sm"
                                    onClick={() => setRejectModal(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 h-10 bg-pt-red hover:bg-pt-red/90 text-white rounded-xl text-sm font-medium"
                                    disabled={processing === rejectModal.id}
                                    onClick={() => handleReject(rejectModal.id)}
                                >
                                    {processing === rejectModal.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Confirm Reject"
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
