"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Bell, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopBarProps {
    title?: string;
    showBack?: boolean;
}

export function TopBar({ title = "PropTrack", showBack = false }: TopBarProps) {
    const { data: session } = useSession();

    return (
        <header className="sticky top-0 z-50 w-full bg-pt-surface/80 backdrop-blur-md border-b border-pt-border flex items-center h-14 px-4">
            {/* Fallback for Back Button if needed, else brand logo */}
            <div className="flex-1 flex items-center gap-2">
                {!showBack && <Building className="w-5 h-5 text-pt-accent" />}
                <span className="font-semibold text-pt-text tracking-tight">{title}</span>
            </div>

            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-pt-text-dim hover:text-pt-text relative">
                    <Bell className="w-5 h-5" />
                    {/* Simulated unread dot */}
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-pt-accent rounded-full border-2 border-pt-surface"></span>
                </Button>

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
