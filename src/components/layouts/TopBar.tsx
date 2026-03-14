"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/shared/BrandLogo";

interface TopBarProps {
    title?: string;
    showBack?: boolean;
}

export function TopBar({ title = "PropTrack", showBack = false }: TopBarProps) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!session?.user) return;
        fetch("/api/notifications")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setHasUnread(data.some(n => !n.read));
                }
            })
            .catch(() => {});
    }, [session?.user, pathname]); // Refetch on route change

    return (
        <header className="sticky top-0 z-50 w-full bg-pt-surface/80 backdrop-blur-md border-b border-pt-border flex items-center h-14 px-4">
            {/* Fallback for Back Button if needed, else brand logo */}
            <div className="flex-1 flex items-center gap-2">
                {!showBack && <BrandLogo className="w-5 h-5 rounded-sm" />}
                <span className="font-semibold text-pt-text tracking-tight">{title}</span>
            </div>

            <div className="flex items-center gap-1">
                <Link href="/notifications">
                    <Button variant="ghost" size="icon" className="text-pt-text-dim hover:text-pt-text relative">
                        <Bell className="w-5 h-5" />
                        {hasUnread && (
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-pt-accent rounded-full border-2 border-pt-surface"></span>
                        )}
                    </Button>
                </Link>

                {session && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="text-pt-text-dim hover:text-pt-red"
                    >
                        <LogOut className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </header>
    );
}
