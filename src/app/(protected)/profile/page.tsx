import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProfileRedirectPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role;
    
    if (role === "MANAGER") {
        redirect("/manager/settings");
    }
    
    if (role === "TECHNICIAN") {
        redirect("/technician/profile");
    }
    
    if (role === "TENANT") {
        redirect("/tenant/profile");
    }
    
    redirect("/login");
}
