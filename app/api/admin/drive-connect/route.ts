import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/admin/drive-callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
