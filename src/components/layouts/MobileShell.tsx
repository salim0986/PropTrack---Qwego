import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileShellProps extends React.HTMLAttributes<HTMLDivElement> { }

/**
 * MobileShell restricts the container width to match mobile dimensions
 * and centers it on larger screens, replicating a mobile app feel
 * on desktop while maintaining true mobile-first on smaller screens.
 */
export function MobileShell({ className, children, ...props }: MobileShellProps) {
    return (
        <div className="min-h-screen bg-pt-bg flex flex-col items-center">
            <div
                className={cn(
                    "w-full h-full min-h-screen max-w-[430px] bg-pt-surface flex flex-col relative",
                    "shadow-2xl sm:border-x border-pt-border/50",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        </div>
    );
}
