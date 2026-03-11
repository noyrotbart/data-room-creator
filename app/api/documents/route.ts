import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDocumentTree } from "@/lib/documents";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getDocumentTree());
}
