import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isAllowedUser, getUserPasswordHashAnyOrg, getAllowedUserByEmail, isOrgAdmin, getUserOrgs } from "@/lib/db";

async function refreshGoogleToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + (data.expires_in as number) * 1000,
      error: undefined,
    };
  } catch (err) {
    console.error("Failed to refresh Google token", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        orgId: { label: "Org ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const orgId = credentials.orgId ? parseInt(credentials.orgId) : null;

        try {
          if (orgId) {
            // Org-scoped login
            const { getUserPasswordHash } = await import("@/lib/db");
            const hash = await getUserPasswordHash(email, orgId);
            if (!hash) return null;
            const valid = await bcrypt.compare(credentials.password, hash);
            if (!valid) return null;
            return { id: email, email, name: email, orgId: String(orgId) };
          }
          // Fallback: find user across any org
          const result = await getUserPasswordHashAnyOrg(email);
          if (!result?.password_hash) return null;
          const valid = await bcrypt.compare(credentials.password, result.password_hash);
          if (!valid) return null;
          return { id: email, email, name: email, orgId: String(result.org_id) };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user, credentials }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "google") return false;

      const email = user.email ?? "";
      try {
        // Find all orgs this user belongs to
        const orgs = await getUserOrgs(email);
        if (!orgs.length) return false;

        // Check if any org has this user without a password (Google-allowed)
        for (const org of orgs) {
          const allowed = await getAllowedUserByEmail(email, org.org_id);
          if (!allowed || allowed.revoked_at) continue;
          if (allowed.expires_at && new Date(allowed.expires_at) < new Date()) continue;
          if (allowed.password_hash) continue; // password-only user
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    async jwt({ token, account, user }) {
      // On initial sign-in, save Google tokens and org info
      if (account?.provider === "google" && account.access_token) {
        // Find user's org(s)
        const orgs = await getUserOrgs(token.email ?? "");
        const firstOrg = orgs[0];
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          orgId: firstOrg?.org_id,
          orgSlug: firstOrg?.org_slug,
          role: firstOrg?.role ?? "viewer",
        };
      }

      // Credentials sign-in: orgId comes from the user object
      if (account?.provider === "credentials" && (user as any)?.orgId) {
        const orgId = parseInt((user as any).orgId);
        const orgs = await getUserOrgs(token.email ?? "");
        const org = orgs.find(o => o.org_id === orgId) ?? orgs[0];
        return {
          ...token,
          orgId: org?.org_id,
          orgSlug: org?.org_slug,
          role: org?.role ?? "viewer",
        };
      }

      // Token still valid?
      const expires = (token.accessTokenExpires as number) ?? 0;
      if (expires && Date.now() < expires) {
        return token;
      }
      // Token expired — refresh if we have a refresh token
      if (token.refreshToken) {
        return refreshGoogleToken(token);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      (session as any).accessToken = token.accessToken;
      (session as any).accessTokenError = token.error;
      (session as any).orgId = token.orgId;
      (session as any).orgSlug = token.orgSlug;
      (session as any).role = token.role;
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

/**
 * Check if a user is an admin for a specific org.
 * Falls back to checking the session role if orgId matches.
 */
export async function checkIsOrgAdmin(email: string | null | undefined, orgId: number): Promise<boolean> {
  if (!email) return false;
  return isOrgAdmin(email, orgId);
}

/** @deprecated Use checkIsOrgAdmin instead. Kept for migration compatibility. */
export function isAdmin(email: string | null | undefined): boolean {
  return email === process.env.ADMIN_EMAIL;
}
