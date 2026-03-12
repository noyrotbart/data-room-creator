import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveDocPath, getMimeType, DOCUMENTS_ROOT } from "@/lib/documents";
import { logView } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Decode each segment (they were encoded by the DocTree component)
  const relPath = params.path.map(decodeURIComponent).join("/");
  const filename = path.basename(relPath);
  const mimeType = getMimeType(filename);

  // Log the view (fire and forget – don't block serving the file)
  logView({
    userEmail: session.user.email,
    userName: session.user.name ?? undefined,
    filePath: relPath,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  }).catch(() => {});

  // --- Local filesystem (dev) ---
  if (fs.existsSync(DOCUMENTS_ROOT)) {
    let absPath: string;
    try {
      absPath = resolveDocPath(relPath);
    } catch {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  }

  // --- Vercel Blob (production) ---
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  // Derive the store's public base URL from the token.
  // Token format: vercel_blob_rw_<storeId>_<secret>
  // Public store hostname: <storeId-lowercase>.public.blob.vercel-storage.com
  const storeId = blobToken.split("_")[3]?.toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "Storage misconfigured" }, { status: 500 });
  }

  // Encode each path segment so spaces / special chars are safe in the URL
  const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
  const blobUrl = `https://${storeId}.public.blob.vercel-storage.com/documents/${encodedPath}`;

  const blobRes = await fetch(blobUrl);
  if (!blobRes.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await blobRes.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": body.byteLength.toString(),
    },
  });
}
