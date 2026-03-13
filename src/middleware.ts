import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;

    // Public routes - allow through
    const publicPaths = ["/login", "/register", "/pending", "/api/buildings"];
    if (publicPaths.some((p) => pathname.startsWith(p))) {
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
