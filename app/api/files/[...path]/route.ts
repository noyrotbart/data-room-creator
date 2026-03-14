import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logView } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { getAdminDriveAccessToken } from "@/lib/drive";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrgFromHeaders();
  const relPath = params.path.map(decodeURIComponent).join("/");
  const filename = path.basename(relPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? "application/octet-stream";

  // Log the view
  logView({
    userEmail: session.user.email,
    userName: session.user.name ?? undefined,
    filePath: relPath,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    orgId: org?.id,
  }).catch(() => {});

  // Serve from Vercel Blob if configured
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    const storeId = blobToken.split("_")[3]?.toLowerCase();
    if (storeId) {
      const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
      const blobUrl = `https://${storeId}.public.blob.vercel-storage.com/documents/${encodedPath}`;
      const blobRes = await fetch(blobUrl);
      if (blobRes.ok) {
        const body = await blobRes.arrayBuffer();
        return new NextResponse(body, {
          headers: { "Content-Type": mimeType, "Content-Disposition": `inline; filename="${filename}"`, "Content-Length": body.byteLength.toString() },
        });
      }
    }
  }

  // Try to serve from Google Drive
  if (org?.drive_folder_id) {
    const accessToken = await getAdminDriveAccessToken(org.id);
    if (accessToken) {
      // Search for the file in Drive by name
      const { default: fetch } = await import("node-fetch") as any;
      // For now, return 404 - Drive file serving needs file ID mapping
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
