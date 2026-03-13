"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BLOCK_REASONS = [
    "Parts not available",
    "Access to unit denied",
    "Specialist required",
    "Safety hazard present",
    "Waiting for utility shutdown",
    "Work order needs approval",
];

export default function BlockTicketPage() {
    const { id } = useParams();
    const router = useRouter();
    const [selected, setSelected] = useState<string | null>(null);
    const [custom, setCustom] = useState("");
    const [loading, setLoading] = useState(false);

    const reason = custom.trim() || selected;
    const canSubmit = !!reason && reason.length >= 5;

    async function handleBlock() {
        if (!canSubmit) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/tickets/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "BLOCK", blockReason: reason }),
            });
            if (!res.ok) throw new Error();
            toast.success("Ticket blocked", { description: "Manager has been notified." });
            router.push("/technician/dashboard");
        } catch {
            toast.error("Failed to block ticket");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-pt-surface/90 backdrop-blur-md border-b border-pt-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-pt-text-dim hover:text-pt-text">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-pt-text">Block Ticket</span>
            </header>

            <div className="flex flex-col gap-5 p-4 pb-72">
                {/* Warning banner */}
                <div className="bg-pt-red/10 border border-pt-red/30 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-pt-red shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-pt-red">Blocking this ticket</p>
                        <p className="text-xs text-pt-text-muted mt-1">
                            This will notify the building manager and pause work. Only block if you genuinely cannot proceed.
                        </p>
                    </div>
                </div>

                {/* Quick-select reasons */}
                <section>
                    <p className="text-sm font-semibold text-pt-text-muted mb-3">Select a reason</p>
                    <div className="flex flex-col gap-2">
                        {BLOCK_REASONS.map((r) => (
                            <motion.button
                                key={r}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelected(r); setCustom(""); }}
                                className={cn(
                                    "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                                    selected === r && !custom
                                        ? "border-pt-red bg-pt-red/10 text-pt-red"
                                        : "border-pt-border bg-pt-surface text-pt-text hover:border-pt-red/40"
                                )}
                            >
                                {r}
                            </motion.button>
                        ))}
                    </div>
                </section>

                {/* Custom reason */}
                <section>
                    <p className="text-sm font-semibold text-pt-text-muted mb-3">Or describe the problem in detail</p>
                    <Textarea
                        value={custom}
                        onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
                        placeholder="Explain why work cannot proceed..."
                        rows={4}
                        className="bg-pt-surface border-pt-border/60 rounded-xl resize-none text-sm"
                    />
                    <p className="text-xs text-pt-text-muted mt-1.5 text-right">{custom.length}/200</p>
                </section>
            </div>

            {/* Submit Bar */}
            <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-pt-surface/95 backdrop-blur-md border-t border-pt-border p-4 z-40">
                <Button
                    onClick={handleBlock}
                    disabled={!canSubmit || loading}
                    className={cn(
                        "w-full h-14 rounded-2xl font-semibold text-base transition-all",
                        canSubmit
                            ? "bg-pt-red hover:bg-pt-red/90 text-white shadow-lg shadow-pt-red/30"
                            : "bg-pt-surface-light text-pt-text-muted border border-pt-border cursor-not-allowed"
                    )}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Block"}
                </Button>
            </div>
        </div>
    );
}
