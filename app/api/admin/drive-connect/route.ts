import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";

export async function GET() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) return new Response("Forbidden", { status: 403 });
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return new Response("Forbidden", { status: 403 });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/admin/drive-callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
    state: org.slug,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
