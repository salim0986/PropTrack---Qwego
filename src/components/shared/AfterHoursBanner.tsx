import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AfterHoursBannerProps {
    className?: string;
    isAfterHours: boolean;
}

export function AfterHoursBanner({ className, isAfterHours }: AfterHoursBannerProps) {
    if (!isAfterHours) return null;

    return (
        <div className={cn("bg-pt-accent-soft border border-pt-accent text-pt-accent px-4 py-3 rounded-md flex items-start gap-3 w-full", className)}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
                <p className="font-semibold">After-Hours Alert</p>
                <p className="opacity-90 mt-0.5">
                    Standard maintenance is currently closed. Only submit this request if it is an absolute emergency.
                </p>
            </div>
        </div>
    );
}
