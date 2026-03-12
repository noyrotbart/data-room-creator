import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { isAllowedUser, getUserPasswordHash } from "@/lib/db";

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
          // Only request basic profile — Drive access is granted separately
          // via the admin /api/admin/drive-connect flow (admin only)
          scope: "openid email profile",
        },
      },
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

    async jwt({ token, account }) {
      // On initial sign-in, save Google tokens
      if (account?.provider === "google" && account.access_token) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
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
      // Expose access token server-side (via getServerSession) for Drive API calls
      (session as any).accessToken = token.accessToken;
      (session as any).accessTokenError = token.error;
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
