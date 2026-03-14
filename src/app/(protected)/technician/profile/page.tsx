"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Wrench, ExternalLink, Copy, Star, CheckCircle2, Clock, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const TELEGRAM_CODE_KEY = "pt_technician_telegram_code";

type StoredTelegramCode = {
    code: string;
    expiresAt: number;
};

interface Stats {
    jobsCompleted: number;
    avgCompletionHours: number | null;
    photoCompliance: number;
    avgRating: number | null;
    totalRatings: number;
    blockedIncidents: number;
}

export default function TechnicianProfilePage() {
    const { data: session } = useSession();
    const [telegramCode, setTelegramCode] = useState<string | null>(null);
    const [telegramCodeExpiresAt, setTelegramCodeExpiresAt] = useState<number | null>(null);
    const [generatingTelegramCode, setGeneratingTelegramCode] = useState(false);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        if (!session?.user?.id) return;
        fetch(`/api/users/${session.user.id}/performance`)
            .then((r) => r.json())
            .then((data) => { if (data.stats) setStats(data.stats); })
            .catch(() => {})
            .finally(() => setStatsLoading(false));
    }, [session?.user?.id]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(TELEGRAM_CODE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as StoredTelegramCode;
            if (!parsed?.code || !parsed?.expiresAt) {
                localStorage.removeItem(TELEGRAM_CODE_KEY);
                return;
            }
            if (Date.now() < parsed.expiresAt) {
                setTelegramCode(parsed.code);
                setTelegramCodeExpiresAt(parsed.expiresAt);
            } else {
                localStorage.removeItem(TELEGRAM_CODE_KEY);
            }
        } catch {
            localStorage.removeItem(TELEGRAM_CODE_KEY);
        }
    }, []);

    async function generateTelegramLink() {
        setGeneratingTelegramCode(true);
        try {
            const res = await fetch("/api/telegram/connect", { method: "POST" });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.message || "Failed to generate code");
            }

            setTelegramCode(data.code);
            const expiresAt = Date.now() + ((data.expiresInSeconds ?? 600) * 1000);
            setTelegramCodeExpiresAt(expiresAt);
            if (typeof window !== "undefined") {
                const value: StoredTelegramCode = { code: data.code, expiresAt };
                localStorage.setItem(TELEGRAM_CODE_KEY, JSON.stringify(value));
            }
            toast.info("Send this code", {
                description: `Message @PropTrackkBot with: ${data.code}`,
                duration: 8000,
            });
        } catch (error: any) {
            toast.error("Could not generate Telegram code", {
                description: error?.message || "Please try again.",
            });
        } finally {
            setGeneratingTelegramCode(false);
        }
    }

    async function handleSignOut() {
        await signOut({ callbackUrl: "/login" });
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Technician</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight">Profile</h1>
            </div>

            {/* Account Info */}
            <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-4">
                <p className="text-xs text-pt-text-muted font-semibold uppercase tracking-wider">Account</p>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-pt-accent/10 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-pt-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-pt-text">{session?.user?.name}</p>
                        <p className="text-sm text-pt-text-muted">{session?.user?.email}</p>
                        <span className="text-xs bg-pt-accent/10 text-pt-accent border border-pt-accent/20 rounded-full px-2 py-0.5 mt-1 inline-block font-medium">
                            Technician
                        </span>
                    </div>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-pt-accent" />
                    <p className="text-xs font-semibold text-pt-text-muted uppercase tracking-wider">Performance</p>
                </div>

                {statsLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-pt-surface-light rounded-xl p-3 h-16 animate-pulse" />
                        ))}
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-pt-surface-light border border-pt-border/50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-pt-green" />
                                <p className="text-[10px] text-pt-text-muted uppercase tracking-wider font-bold">Completed</p>
                            </div>
                            <p className="text-2xl font-bold text-pt-text">{stats.jobsCompleted}</p>
                            <p className="text-[10px] text-pt-text-muted">jobs total</p>
                        </div>
                        <div className="bg-pt-surface-light border border-pt-border/50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Star className="w-3.5 h-3.5 text-pt-yellow" />
                                <p className="text-[10px] text-pt-text-muted uppercase tracking-wider font-bold">Avg Rating</p>
                            </div>
                            <p className="text-2xl font-bold text-pt-text">
                                {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
                            </p>
                            <p className="text-[10px] text-pt-text-muted">
                                {stats.totalRatings > 0 ? `from ${stats.totalRatings} reviews` : "no reviews yet"}
                            </p>
                        </div>
                        <div className="bg-pt-surface-light border border-pt-border/50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-3.5 h-3.5 text-pt-blue" />
                                <p className="text-[10px] text-pt-text-muted uppercase tracking-wider font-bold">Avg Time</p>
                            </div>
                            <p className="text-2xl font-bold text-pt-text">
                                {stats.avgCompletionHours !== null ? `${stats.avgCompletionHours}h` : "—"}
                            </p>
                            <p className="text-[10px] text-pt-text-muted">to complete</p>
                        </div>
                        <div className="bg-pt-surface-light border border-pt-border/50 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-pt-accent" />
                                <p className="text-[10px] text-pt-text-muted uppercase tracking-wider font-bold">Photo Compliance</p>
                            </div>
                            <p className={cn("text-2xl font-bold", stats.photoCompliance >= 90 ? "text-pt-green" : stats.photoCompliance >= 70 ? "text-pt-yellow" : "text-pt-red")}>
                                {stats.photoCompliance}%
                            </p>
                            <p className="text-[10px] text-pt-text-muted">of jobs with proof</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-pt-text-muted text-center py-3">No stats available yet.</p>
                )}
            </div>

            {/* Telegram Connect */}
            <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <p className="text-xs text-pt-text-muted font-semibold uppercase tracking-wider flex-1">
                        Telegram Notifications
                    </p>
                    <span className="text-xs bg-pt-text-muted/20 text-pt-text-muted rounded-full px-2 py-0.5">Optional</span>
                </div>
                <p className="text-xs text-pt-text-muted leading-relaxed">
                    Connect Telegram to receive instant push notifications for new assignments and escalations.
                </p>

                {telegramCode && (
                    <div className="bg-pt-surface-light border border-pt-border rounded-xl p-3">
                        <p className="text-xs text-pt-text-muted mb-1">Send this to @PropTrackkBot:</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm text-pt-accent font-mono">{telegramCode}</code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(telegramCode);
                                    toast.success("Copied!");
                                }}
                                className="text-pt-text-muted hover:text-pt-text"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-pt-text-muted/60 mt-1.5">
                            {telegramCodeExpiresAt && Date.now() < telegramCodeExpiresAt
                                ? `Code saved until ${new Date(telegramCodeExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                : "This code expires in 10 minutes"}
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl text-sm border-pt-border"
                        onClick={generateTelegramLink}
                        disabled={generatingTelegramCode}
                    >
                        {generatingTelegramCode
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Generating...</>
                            : (telegramCode ? "Regenerate Code" : "Get Connection Code")}
                    </Button>
                    <a
                        href="https://t.me/PropTrackkBot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-3 rounded-xl border border-pt-border flex items-center justify-center text-pt-text-muted hover:text-pt-text"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Sign Out */}
            <Button
                variant="outline"
                className="h-11 border-pt-red/30 text-pt-red hover:bg-pt-red/10 rounded-xl w-full"
                onClick={handleSignOut}
            >
                Sign Out
            </Button>
        </div>
    );
}
