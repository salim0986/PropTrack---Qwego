import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ticketStatusEnum } from "@/../db/schema";

type StatusType = typeof ticketStatusEnum.enumValues[number];

const statusVariants = cva(
    "inline-flex items-center gap-2 rounded-[5px] px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider transition-colors border",
    {
        variants: {
            status: {
                OPEN: "bg-pt-blue/10 text-pt-blue border-pt-blue/20",
                ASSIGNED: "bg-pt-purple/10 text-pt-purple border-pt-purple/20",
                IN_PROGRESS: "bg-pt-yellow/10 text-pt-yellow border-pt-yellow/20",
                BLOCKED: "bg-pt-red/10 text-pt-red border-pt-red/20",
                DONE: "bg-pt-green/10 text-pt-green border-pt-green/20",
                REOPENED: "bg-pt-accent/10 text-pt-accent border-pt-accent/20",
                CLOSED_DUPLICATE: "bg-pt-surface-light text-pt-text-muted border-pt-border",
            },
        },
        defaultVariants: {
            status: "OPEN",
        },
    }
);

const dotVariants = cva("h-1.5 w-1.5 rounded-full", {
    variants: {
        status: {
            OPEN: "bg-pt-blue animate-pulse",
            ASSIGNED: "bg-pt-purple",
            IN_PROGRESS: "bg-pt-yellow animate-pulse",
            BLOCKED: "bg-pt-red",
            DONE: "bg-pt-green",
            REOPENED: "bg-pt-accent animate-pulse",
            CLOSED_DUPLICATE: "bg-pt-text-muted",
        },
    },
});

export interface StatusBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusVariants> {
    status: StatusType;
    showDot?: boolean;
}

export function StatusBadge({
    className,
    status,
    showDot = true,
    ...props
}: StatusBadgeProps) {
    return (
        <div className={cn(statusVariants({ status }), className)} {...props}>
            {showDot && <span className={cn(dotVariants({ status }))} />}
            {status.replace("_", " ")}
        </div>
    );
}
