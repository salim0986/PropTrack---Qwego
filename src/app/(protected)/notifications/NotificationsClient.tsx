"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellOff, CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    createdAt: Date;
    ticket?: { id: string; title: string } | null;
}

export function NotificationsClient({
    notifications: initial,
    role,
}: {
    notifications: Notification[];
    role: string;
}) {
    const [notifications, setNotifications] = useState(initial);
    const [markingAll, setMarkingAll] = useState(false);

    async function markRead(id: string) {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    }

    async function markAllRead() {
        setMarkingAll(true);
        try {
            await fetch("/api/notifications/read-all", { method: "PATCH" });
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            toast.success("All notifications marked as read");
        } catch {
            toast.error("Failed to mark all as read");
        } finally {
            setMarkingAll(false);
        }
    }

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="flex flex-col gap-4 p-4 pb-28">
            <div className="flex items-center justify-between pt-1">
                <div>
                    <p className="text-pt-text-dim text-sm capitalize">{role.toLowerCase()}</p>
                    <h1 className="text-2xl font-bold text-pt-text tracking-tight flex items-center gap-2">
                        Notifications
                        {unreadCount > 0 && (
                            <span className="text-sm font-medium bg-pt-accent text-white rounded-full px-2 py-0.5">
                                {unreadCount}
                            </span>
                        )}
                    </h1>
                </div>
                {unreadCount > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={markAllRead}
                        disabled={markingAll}
                        className="text-xs border-pt-border text-pt-text-muted h-9"
                    >
                        <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                        Mark all read
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="bg-pt-surface border border-pt-border rounded-2xl p-10 text-center">
                    <BellOff className="w-10 h-10 text-pt-text-muted mx-auto mb-3" />
                    <p className="text-pt-text font-medium">No notifications yet</p>
                    <p className="text-sm text-pt-text-muted mt-1">You&apos;ll see updates here as they happen.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {notifications.map((notification) => {
                        let redirectPath = null;
                        if (notification.ticket) {
                            redirectPath = `/${role.toLowerCase()}/${role === "TECHNICIAN" ? "tasks" : "tickets"}/${notification.ticket.id}`;
                        } else if (notification.type === "APPROVAL_REQUEST" && role === "MANAGER") {
                            redirectPath = "/manager/registrations";
                        } else if ((notification.type === "APPROVED" || notification.type === "REJECTED") && role === "TECHNICIAN") {
                            redirectPath = "/technician/dashboard";
                        }

                        return (
                            <div
                                key={notification.id}
                                onClick={() => !notification.read && markRead(notification.id)}
                                className={cn(
                                    "bg-pt-surface border rounded-xl p-4 transition-all",
                                    notification.read
                                        ? "border-pt-border opacity-60"
                                        : "border-pt-accent/30 cursor-pointer hover:border-pt-accent/50"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                        notification.read ? "bg-transparent" : "bg-pt-accent"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-pt-text">{notification.title}</p>
                                        <p className="text-xs text-pt-text-muted mt-0.5 leading-relaxed">{notification.message}</p>
                                        <p className="text-[11px] text-pt-text-muted/60 mt-1.5">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {redirectPath && (
                                        <Link
                                            href={redirectPath}
                                            onClick={(e) => {
                                                if (!notification.read) markRead(notification.id);
                                            }}
                                            className="shrink-0 text-pt-text-muted hover:text-pt-accent"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
