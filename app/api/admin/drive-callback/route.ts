import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setAdminToken, isOrgAdmin, getOrgBySlug } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const orgSlug = url.searchParams.get("state");

  if (!orgSlug) return new Response("Missing org context", { status: 400 });
  const org = await getOrgBySlug(orgSlug);
  if (!org) return new Response("Org not found", { status: 404 });

  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return new Response("Forbidden", { status: 403 });

  if (error || !code) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/admin/drive?drive_error=${error ?? "no_code"}`);
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/admin/drive-callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    return Response.redirect(`${process.env.NEXTAUTH_URL}/admin/drive?drive_error=token_exchange`);
  }

  const data = await res.json();
  await setAdminToken("drive_access_token", data.access_token, org.id);
  if (data.refresh_token) {
    await setAdminToken("drive_refresh_token", data.refresh_token, org.id);
  }
  await setAdminToken("drive_token_expires", String(Date.now() + (data.expires_in as number) * 1000), org.id);

  return Response.redirect(`${process.env.NEXTAUTH_URL}/admin/drive`);
}
