"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { User, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

export default function TenantProfilePage() {
    const { data: session } = useSession();
    const [telegramCode, setTelegramCode] = useState<string | null>(null);

    async function generateTelegramLink() {
        try {
            const res = await fetch("/api/telegram/connect", { method: "POST" });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.message || "Failed to generate code");
            }

            setTelegramCode(data.code);
            toast.info("Send this code", {
                description: `Message @PropTrackBot with: ${data.code}`,
                duration: 8000,
            });
        } catch (error: any) {
            toast.error("Could not generate Telegram code", {
                description: error?.message || "Please try again.",
            });
        }
    }

    async function handleSignOut() {
        await signOut({ callbackUrl: "/login" });
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            <div className="pt-1">
                <p className="text-pt-text-dim text-sm">Tenant</p>
                <h1 className="text-2xl font-bold text-pt-text tracking-tight">Profile</h1>
            </div>

            {/* Account Info */}
            <div className="bg-pt-surface border border-pt-border rounded-2xl p-4 space-y-4">
                <p className="text-xs text-pt-text-muted font-semibold uppercase tracking-wider">Account</p>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-pt-accent/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-pt-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-pt-text">{session?.user?.name}</p>
                        <p className="text-sm text-pt-text-muted">{session?.user?.email}</p>
                        <span className="text-xs bg-pt-accent/10 text-pt-accent border border-pt-accent/20 rounded-full px-2 py-0.5 mt-1 inline-block font-medium">
                            Tenant
                        </span>
                    </div>
                </div>
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
                    Connect Telegram to receive instant push notifications for your ticket updates.
                </p>

                {telegramCode && (
                    <div className="bg-pt-surface-light border border-pt-border rounded-xl p-3">
                        <p className="text-xs text-pt-text-muted mb-1">Send this to @PropTrackBot:</p>
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
                        <p className="text-xs text-pt-text-muted/60 mt-1.5">This code expires in 10 minutes</p>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl text-sm border-pt-border"
                        onClick={generateTelegramLink}
                    >
                        {telegramCode ? "Regenerate Code" : "Get Connection Code"}
                    </Button>
                    <a
                        href="https://t.me/PropTrackBot"
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
                className="h-11 border-pt-red/30 text-pt-red hover:bg-pt-red/10 rounded-xl w-full mt-4"
                onClick={handleSignOut}
            >
                Sign Out
            </Button>
        </div>
    );
}
