import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { priorityEnum } from "@/../db/schema";
import { AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";

type PriorityType = typeof priorityEnum.enumValues[number];

const priorityVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            priority: {
                LOW: "bg-pt-surface-light text-pt-text-muted border border-pt-border",
                MEDIUM: "bg-pt-blue/10 text-pt-blue border border-pt-blue/20",
                HIGH: "bg-pt-accent/10 text-pt-accent border border-pt-accent/20",
                URGENT: "bg-pt-red/10 text-pt-red border border-pt-red/20 animate-pulse-slow",
            },
        },
        defaultVariants: {
            priority: "MEDIUM",
        },
    }
);

export interface PriorityBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof priorityVariants> {
    priority: PriorityType;
}

export function PriorityBadge({
    className,
    priority,
    ...props
}: PriorityBadgeProps) {
    const Icon = {
        LOW: ArrowDown,
        MEDIUM: Minus,
        HIGH: ArrowUp,
        URGENT: AlertCircle,
    }[priority];

    return (
        <div className={cn(priorityVariants({ priority }), className)} {...props}>
            <Icon className="h-3.5 w-3.5" />
            {priority.charAt(0) + priority.slice(1).toLowerCase()}
        </div>
    );
}
