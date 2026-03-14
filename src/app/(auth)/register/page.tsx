"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, User, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/BrandLogo";

type Role = "TENANT" | "TECHNICIAN";

interface Building {
    id: string;
    name: string;
    address: string;
}

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState<Role>("TENANT");
    const [buildings, setBuildings] = useState<Building[]>([]);

    // Fetch buildings for tenant selection
    useEffect(() => {
        fetch("/api/buildings")
            .then((r) => r.json())
            .then(setBuildings)
            .catch(() => setBuildings([]));
    }, []);

    async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const payload: Record<string, string> = {
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            password: formData.get("password") as string,
            role,
        };

        if (role === "TENANT") {
            payload.buildingId = formData.get("buildingId") as string;
            payload.unitNumber = formData.get("unitNumber") as string;
        }

        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
            toast.error(data.message || "Registration failed");
            setLoading(false);
            return;
        }

        if (role === "TECHNICIAN") {
            toast.success("Application submitted!", {
                description: "A manager will review your account shortly.",
            });
            router.push("/pending?status=PENDING");
        } else {
            toast.success("Account created!", {
                description: "Please sign in to continue.",
            });
            router.push("/login");
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-pt-bg p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full max-w-sm"
            >
                <div className="bg-pt-surface shadow-2xl rounded-2xl border border-pt-border/60 p-6 sm:p-8 flex flex-col items-center">
                    <div className="w-12 h-12 bg-pt-surface-light border border-pt-border/60 rounded-xl flex items-center justify-center mb-6">
                        <BrandLogo className="w-8 h-8 rounded-md" priority />
                    </div>

                    <div className="text-center space-y-1.5 mb-6">
                        <h1 className="text-2xl font-bold tracking-tight text-pt-text">Create Account</h1>
                        <p className="text-sm text-pt-text-dim">Join PropTrack to manage your maintenance requests.</p>
                    </div>

                    {/* Role Selector */}
                    <div className="flex w-full bg-pt-surface-light rounded-xl p-1 mb-6 gap-1">
                        {(["TENANT", "TECHNICIAN"] as Role[]).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-all",
                                    role === r
                                        ? "bg-pt-accent text-white shadow-sm"
                                        : "text-pt-text-muted hover:text-pt-text"
                                )}
                            >
                                {r === "TENANT" ? <User className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                                {r === "TENANT" ? "Tenant" : "Technician"}
                            </button>
                        ))}
                    </div>

                    {role === "TECHNICIAN" && (
                        <div className="w-full mb-4 bg-pt-yellow/10 border border-pt-yellow/30 rounded-xl p-3 flex items-start gap-2">
                            <span className="text-pt-yellow text-xs font-medium leading-relaxed">
                                ⚠️ Technician accounts require manager approval before you can log in. You will receive a notification when approved.
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="w-full space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-pt-text-muted">Full Name</Label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                placeholder="Your full name"
                                required
                                minLength={2}
                                className="bg-pt-surface-light border-pt-border/50 focus-visible:ring-pt-accent h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-pt-text-muted">Email Address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                required
                                autoComplete="email"
                                className="bg-pt-surface-light border-pt-border/50 focus-visible:ring-pt-accent h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-pt-text-muted">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={8}
                                placeholder="Min. 8 characters"
                                autoComplete="new-password"
                                className="bg-pt-surface-light border-pt-border/50 focus-visible:ring-pt-accent h-11"
                            />
                        </div>

                        <AnimatePresence>
                            {role === "TENANT" && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        <Label htmlFor="buildingId" className="text-pt-text-muted">Building</Label>
                                        <select
                                            id="buildingId"
                                            name="buildingId"
                                            required
                                            className="w-full h-11 bg-pt-surface-light border border-pt-border/50 rounded-md px-3 text-sm text-pt-text focus:outline-none focus:ring-1 focus:ring-pt-accent"
                                        >
                                            <option value="">Select your building...</option>
                                            {buildings.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} — {b.address}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="unitNumber" className="text-pt-text-muted">Unit Number</Label>
                                        <Input
                                            id="unitNumber"
                                            name="unitNumber"
                                            type="text"
                                            placeholder="e.g. 4B"
                                            required
                                            className="bg-pt-surface-light border-pt-border/50 focus-visible:ring-pt-accent h-11"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-pt-accent hover:bg-pt-accent/90 text-white font-medium shadow-md shadow-pt-accent/20 transition-all mt-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {role === "TECHNICIAN" ? "Submit Application" : "Create Account"}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-pt-text-muted">
                        Already have an account?{" "}
                        <Link href="/login" className="text-pt-accent font-medium hover:underline">
                            Sign in
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
