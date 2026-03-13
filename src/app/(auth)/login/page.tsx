"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building, ArrowRight, Loader2, User, Wrench, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";

const DEMO_CREDENTIALS = [
    { role: "Tenant", email: "tenant@proptrack.io", password: "Demo1234!", icon: User, color: "text-pt-green" },
    { role: "Manager", email: "manager@proptrack.io", password: "Demo1234!", icon: Shield, color: "text-pt-purple" },
    { role: "Technician", email: "tech@proptrack.io", password: "Demo1234!", icon: Wrench, color: "text-pt-accent" },
];

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function autofill(cred: typeof DEMO_CREDENTIALS[0]) {
        setEmail(cred.email);
        setPassword(cred.password);
        toast.info(`Demo: ${cred.role}`, { description: cred.email, duration: 2000 });
    }

    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (res?.error) {
            // Handle structured error codes from auth.ts
            if (res.error.includes("ACCOUNT_PENDING") || (res.error === "CredentialsSignin" && res.code === "ACCOUNT_PENDING")) {
                router.push("/pending?status=PENDING");
                return;
            }
            if (res.error.includes("ACCOUNT_REJECTED") || (res.error === "CredentialsSignin" && res.code === "ACCOUNT_REJECTED")) {
                router.push("/pending?status=REJECTED");
                return;
            }
            // Check for the raw error code passed through NextAuth
            if (res.code === "ACCOUNT_PENDING") {
                router.push("/pending?status=PENDING");
                return;
            }
            if (res.code === "ACCOUNT_REJECTED") {
                router.push("/pending?status=REJECTED");
                return;
            }
            toast.error("Invalid credentials", {
                description: "Please check your email and password.",
            });
            setLoading(false);
        } else {
            toast.success("Welcome back!", {
                description: "Redirecting to your dashboard...",
            });
            router.push("/");
            router.refresh();
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
                    <div className="w-12 h-12 bg-pt-accent/10 rounded-xl flex items-center justify-center mb-6">
                        <Building className="w-6 h-6 text-pt-accent" />
                    </div>

                    <div className="text-center space-y-1.5 mb-6">
                        <h1 className="text-2xl font-bold tracking-tight text-pt-text">Welcome back</h1>
                        <p className="text-sm text-pt-text-dim">Sign in to PropTrack.</p>
                    </div>

                    {/* Demo Credential Quick Fill */}
                    <div className="w-full mb-6">
                        <p className="text-xs text-pt-text-muted mb-2 text-center">Quick Demo Login</p>
                        <div className="flex gap-2">
                            {DEMO_CREDENTIALS.map((cred) => {
                                const Icon = cred.icon;
                                return (
                                    <button
                                        key={cred.role}
                                        type="button"
                                        onClick={() => autofill(cred)}
                                        className={cn(
                                            "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border border-pt-border hover:border-pt-accent/40 bg-pt-surface-light transition-all",
                                        )}
                                    >
                                        <Icon className={cn("w-4 h-4", cred.color)} />
                                        <span className="text-[10px] text-pt-text-muted font-medium">{cred.role}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="w-full space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-pt-text-muted">Email address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="bg-pt-surface-light border-pt-border/50 focus-visible:ring-pt-accent h-11"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-pt-accent hover:bg-pt-accent/90 text-white font-medium shadow-md shadow-pt-accent/20 transition-all mt-6"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Sign in
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-pt-text-muted">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-pt-accent font-medium hover:underline">
                            Register
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
