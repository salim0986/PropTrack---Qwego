"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/layouts/TopBar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function UnblockForm({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!note.trim()) {
            toast.error("Please provide an unblock reason");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`/api/tickets/${ticketId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "IN_PROGRESS",
                    action: "UNBLOCK",
                    unblockNote: note.trim()
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to unblock task");
            }

            toast.success("Task unblocked successfully");
            router.push(`/technician/tasks/${ticketId}`);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-pt-surface">
            <TopBar title="Unblock Task" />

            <main className="flex-1 overflow-y-auto px-4 pt-4 pb-72">
                <form id="unblock-form" onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-emerald-500 font-medium text-sm mb-1">Resuming Work</h3>
                            <p className="text-xs text-pt-muted leading-relaxed">
                                Please provide details on how the blocking issue was resolved before resuming work.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-pt-muted ml-1">
                            Resolution Details <span className="text-pt-red">*</span>
                        </label>
                        <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Parts arrived, access granted, or issue resolved..."
                            className="h-32 bg-white/5 border-pt-border/50 rounded-2xl p-4 text-[15px] resize-none focus:bg-white/10 transition-colors placeholder:text-pt-muted/50"
                        />
                    </div>
                </form>
            </main>

            <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] p-4 bg-pt-surface/95 backdrop-blur-md border-t border-pt-border z-40">
                <div className="max-w-lg mx-auto flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="flex-1 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="unblock-form"
                        disabled={isLoading || !note.trim()}
                        className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            "Unblock Task"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}