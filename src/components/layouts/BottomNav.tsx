"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Home, PlusCircle, User, Wrench, Settings } from "lucide-react";

export function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // Use session role instead of URL pathname for checking which state we are in
    const role = session?.user?.role;
    
    // Safefallbacks to avoid crash during hydration
    const isTenant = role === "TENANT";
    const isTechnician = role === "TECHNICIAN";
    const isManager = role === "MANAGER";

    // Determine active flow tab options
    const navItems = isTenant
        ? [
            { href: "/tenant/dashboard", matchPaths: ["/tenant/dashboard"], label: "Home", icon: Home },
            { href: "/tenant/tickets/new", matchPaths: ["/tenant/tickets/new"], label: "Report", icon: PlusCircle },
            { href: "/tenant/profile", matchPaths: ["/tenant/profile", "/profile"], label: "Profile", icon: User },
        ]
        : isTechnician
            ? [
                { href: "/technician/dashboard", matchPaths: ["/technician/dashboard"], label: "Tasks", icon: Wrench },
                { href: "/technician/profile", matchPaths: ["/technician/profile", "/profile"], label: "Profile", icon: User },
            ]
            : isManager
                ? [
                    { href: "/manager/dashboard", matchPaths: ["/manager/dashboard"], label: "Dashboard", icon: Home },
                    { href: "/manager/tickets", matchPaths: ["/manager/tickets"], label: "Tickets", icon: PlusCircle },
                    { href: "/manager/registrations", matchPaths: ["/manager/registrations"], label: "Approvals", icon: User },
                    { href: "/manager/settings", matchPaths: ["/manager/settings", "/profile"], label: "Settings", icon: Settings },
                ]
                : [];

    if (!isTenant && !isTechnician && !isManager) return null; // Don't show on login/splash

    return (
        <nav className="fixed bottom-0 w-full max-w-[430px] mx-auto bg-pt-surface border-t border-pt-border pb-[env(safe-area-inset-bottom)] h-16 sm:h-20 z-50">
            <div className="flex h-16 sm:h-20 items-center justify-around px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || item.matchPaths.some(p => pathname.startsWith(p));
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
