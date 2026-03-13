import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

class AccountPendingError extends CredentialsSignin {
    code = "ACCOUNT_PENDING"
}

class AccountRejectedError extends CredentialsSignin {
    code = "ACCOUNT_REJECTED"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (!parsedCredentials.success) return null;

                const { email, password } = parsedCredentials.data;

                const user = await db.query.usersTable.findFirst({
                    where: eq(usersTable.email, email),
                });

                if (!user) return null;

                // Block PENDING and REJECTED users with specific error codes
                // The login page reads these to redirect to /pending
                if (user.status === "PENDING") {
                    throw new AccountPendingError();
                }
                if (user.status === "REJECTED") {
                    throw new AccountRejectedError();
                }

                const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
                if (!passwordsMatch) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    buildingId: user.buildingId,
                } as any;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.buildingId = (user as any).buildingId;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role;
                (session.user as any).buildingId = token.buildingId;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
});
