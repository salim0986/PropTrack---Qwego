"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";

function PendingContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get("status") || "PENDING";
    const reason = searchParams.get("reason") || null;

    const isPending = status === "PENDING";

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-pt-bg p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full max-w-sm"
            >
                <div className="bg-pt-surface shadow-2xl rounded-2xl border border-pt-border/60 p-8 flex flex-col items-center text-center">
                    {/* Icon */}
                    <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                            isPending ? "bg-pt-yellow/10" : "bg-pt-red/10"
                        }`}
                    >
                        {isPending ? (
                            <Clock className="w-8 h-8 text-pt-yellow" />
                        ) : (
                            <XCircle className="w-8 h-8 text-pt-red" />
                        )}
                    </div>

                    {/* Title */}
                    <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isPending ? "text-pt-yellow" : "text-pt-red"}`}>
                        {isPending ? "Verification Pending" : "Access Denied"}
                    </h1>

                    {/* Message */}
                    <p className="text-sm text-pt-text-muted leading-relaxed mb-6">
                        {isPending
                            ? "Your technician application has been submitted and is currently under review. A manager will approve or reject your account shortly."
                            : "Your technician application was reviewed and was not approved at this time."}
                    </p>

                    {/* Rejection Reason */}
                    {!isPending && reason && (
                        <div className="w-full bg-pt-red/10 border border-pt-red/30 rounded-xl p-4 mb-6 text-left">
                            <p className="text-xs font-semibold text-pt-red mb-1">Manager&apos;s Note:</p>
                            <p className="text-sm text-pt-text">{reason}</p>
                        </div>
                    )}

                    {/* Status Badge */}
                    {isPending && (
                        <div className="w-full bg-pt-surface-light border border-pt-border rounded-xl p-4 mb-6 flex items-center gap-3">
                            <div className="w-8 h-8 bg-pt-yellow/10 rounded-xl flex items-center justify-center shrink-0">
                                <BrandLogo className="w-4 h-4 rounded-sm" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-pt-text-muted">Application Status</p>
                                <p className="text-sm font-semibold text-pt-yellow">Awaiting Manager Review</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="w-full flex flex-col gap-3">
                        <Link href="/login" className="w-full">
                            <Button
                                variant="outline"
                                className="w-full h-11 border-pt-border text-pt-text-muted hover:text-pt-text"
                            >
                                Back to Login
                            </Button>
                        </Link>

                        {!isPending && (
                            <Link href="/register" className="w-full">
                                <Button className="w-full h-11 bg-pt-accent hover:bg-pt-accent/90 text-white">
                                    Register Again
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        )}
                    </div>

                    <p className="text-xs text-pt-text-muted mt-6">
                        Questions? Contact your building manager directly.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function PendingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-pt-bg">
                <Loader2 className="w-8 h-8 text-pt-accent animate-spin" />
            </div>
        }>
            <PendingContent />
        </Suspense>
    );
}
