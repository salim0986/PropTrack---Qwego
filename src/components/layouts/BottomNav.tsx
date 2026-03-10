"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Home, PlusCircle, User, Wrench } from "lucide-react";

export function BottomNav() {
    const pathname = usePathname();

    // Simple hardcoded map for demo MVP
    const isTenant = pathname.startsWith("/tenant");
    const isTechnician = pathname.startsWith("/technician");
    const isManager = pathname.startsWith("/manager");

    // Determine active flow tab options
    const navItems = isTenant
        ? [
            { href: "/tenant/dashboard", label: "Home", icon: Home },
            { href: "/tenant/tickets/new", label: "Report", icon: PlusCircle },
            { href: "/profile", label: "Profile", icon: User },
        ]
        : isTechnician
            ? [
                { href: "/technician/dashboard", label: "Tasks", icon: Wrench },
                { href: "/profile", label: "Profile", icon: User },
            ]
            : [
                { href: "/manager/dashboard", label: "Dashboard", icon: Home },
                { href: "/manager/tickets", label: "Triage", icon: PlusCircle },
            ];

    if (!isTenant && !isTechnician && !isManager) return null; // Don't show on login/splash

    return (
        <nav className="fixed bottom-0 w-full max-w-[430px] mx-auto bg-pt-surface border-t border-pt-border pb-[env(safe-area-inset-bottom)] h-16 sm:h-20 z-50">
            <div className="flex h-16 sm:h-20 items-center justify-around px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all",
                                isActive ? "text-pt-accent" : "text-pt-text-muted hover:text-pt-text-dim"
                            )}
                        >
                            <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                            <span className="text-[10px] sm:text-xs font-medium tracking-wide">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
