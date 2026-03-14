import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    alt?: string;
    priority?: boolean;
}

export function BrandLogo({ className, alt = "PropTrack logo", priority = false }: BrandLogoProps) {
    return (
        <div className={cn("relative w-6 h-6 shrink-0 overflow-hidden rounded-md", className)}>
            <Image
                src="/logo.png"
                alt={alt}
                fill
                sizes="48px"
                className="object-contain"
                priority={priority}
            />
        </div>
    );
}
