import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isAllowedUser, getUserPasswordHash } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        try {
          const hash = await getUserPasswordHash(email);
          if (!hash) return null;
          const valid = await bcrypt.compare(credentials.password, hash);
          if (!valid) return null;
          return { id: email, email, name: email };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      // Credentials provider: authorize() already validated password + allowed status
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "google") return false;
      // Admin always allowed
      if (isAdmin(user.email)) return true;
      // Everyone else must be explicitly granted access
      try {
        return await isAllowedUser(user.email ?? "");
      } catch {
        return false; // fail closed if DB is unreachable
      }
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
};

export function isAdmin(email: string | null | undefined): boolean {
  return email === process.env.ADMIN_EMAIL;
}
