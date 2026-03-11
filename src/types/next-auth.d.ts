import "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: "TENANT" | "MANAGER" | "TECHNICIAN";
            buildingId?: string | null;
        };
    }

    interface User {
        id: string;
        role: "TENANT" | "MANAGER" | "TECHNICIAN";
        buildingId?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: "TENANT" | "MANAGER" | "TECHNICIAN";
        buildingId?: string | null;
    }
}
