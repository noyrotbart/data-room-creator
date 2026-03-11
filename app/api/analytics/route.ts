import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getViewsByFile, getViewsByUser, getRecentViews } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [recent, byFile, byUser] = await Promise.all([
    getRecentViews(100),
    getViewsByFile(),
    getViewsByUser(),
  ]);

  return NextResponse.json({ recent, byFile, byUser });
}
