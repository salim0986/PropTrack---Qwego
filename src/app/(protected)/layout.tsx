import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { MobileShell } from "@/components/layouts/MobileShell";
import { TopBar } from "@/components/layouts/TopBar";
import { BottomNav } from "@/components/layouts/BottomNav";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Basic Role Gatekeeping
    // E.g. If tenant tries to access /manager, they will be redirected eventually by middleware or page load.

    return (
        <SessionProvider session={session}>
            <MobileShell>
                <TopBar />
                <main className="flex-1 w-full overflow-y-auto overflow-x-hidden pt-4 pb-24 px-4 bg-pt-bg">
                    {children}
                </main>
                <BottomNav />
            </MobileShell>
        </SessionProvider>
    );
}
