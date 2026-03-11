import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Root page: redirect to role-specific dashboard
export default async function RootPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = session.user.role;

    if (role === "TENANT") redirect("/tenant/dashboard");
    if (role === "TECHNICIAN") redirect("/technician/dashboard");
    if (role === "MANAGER") redirect("/manager/dashboard");

    // Fallback
    redirect("/login");
}
