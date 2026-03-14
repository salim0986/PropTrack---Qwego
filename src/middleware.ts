import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;

    // Public API route - always allow through (used by registration and manager settings fetches)
    if (pathname.startsWith("/api/buildings")) {
        return NextResponse.next();
    }

    // Telegram webhook must be publicly reachable by Telegram servers.
    if (pathname.startsWith("/api/telegram/webhook")) {
        return NextResponse.next();
    }

    // Cron endpoints perform their own bearer-token auth using CRON_SECRET.
    if (pathname.startsWith("/api/cron/")) {
        return NextResponse.next();
    }

    // Public auth routes - allow through
    const authPages = ["/login", "/register", "/pending"];
    if (authPages.some((p) => pathname.startsWith(p))) {
        // If already logged in and tries to visit auth pages → redirect to dashboard
        if (session?.user) {
            const role = session.user.role;
            if (role === "TENANT") return NextResponse.redirect(new URL("/tenant/dashboard", req.url));
            if (role === "TECHNICIAN") return NextResponse.redirect(new URL("/technician/dashboard", req.url));
            if (role === "MANAGER") return NextResponse.redirect(new URL("/manager/dashboard", req.url));
        }
        return NextResponse.next();
    }

    // Protected routes - require auth
    if (!session?.user) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = session.user.role;

    // Role route enforcement
    if (pathname.startsWith("/manager") && role !== "MANAGER") {
        return NextResponse.redirect(new URL(`/${role.toLowerCase()}/dashboard`, req.url));
    }
    if (pathname.startsWith("/tenant") && role !== "TENANT") {
        return NextResponse.redirect(new URL(`/${role.toLowerCase()}/dashboard`, req.url));
    }
    if (pathname.startsWith("/technician") && role !== "TECHNICIAN") {
        return NextResponse.redirect(new URL(`/${role.toLowerCase()}/dashboard`, req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        "/((?!_next|api/auth|favicon.ico|.*\\.(?:png|jpg|svg|gif|ico|webp|woff|woff2|ttf|css|js)).*)",
    ],
};
