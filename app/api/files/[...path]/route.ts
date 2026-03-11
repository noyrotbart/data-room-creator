import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveDocPath, getMimeType, DOCUMENTS_ROOT } from "@/lib/documents";
import { logView } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";
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
  const isPdf = mimeType === "application/pdf";

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
        "Content-Disposition": isPdf
          ? `inline; filename="${filename}"`
          : `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  }

  // --- Vercel Blob (production) ---
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const blobKey = `documents/${relPath}`;
  let blobMeta: Awaited<ReturnType<typeof head>>;
  try {
    blobMeta = await head(blobKey, { token: blobToken });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Proxy through our server so the URL stays authenticated
  const blobRes = await fetch(blobMeta.url);
  const body = await blobRes.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": isPdf
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`,
      "Content-Length": body.byteLength.toString(),
    },
  });
}
