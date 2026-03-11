import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { resolveDocPath, getMimeType, DOCUMENTS_ROOT } from "@/lib/documents";
import { Navbar } from "@/components/Navbar";
import path from "path";
import fs from "fs";
import { ViewerClient } from "./ViewerClient";

interface Props {
  params: { path: string[] };
}

export default async function ViewPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const relPath = params.path.map(decodeURIComponent).join("/");

  // In local dev, validate the file exists on the filesystem.
  // In production (Vercel Blob), DOCUMENTS_ROOT doesn't exist so we skip the check
  // and let the /api/files route handle the actual lookup.
  if (fs.existsSync(DOCUMENTS_ROOT)) {
    let absPath: string;
    try {
      absPath = resolveDocPath(relPath);
    } catch {
      return <div className="p-8 text-red-500">Invalid path</div>;
    }
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return <div className="p-8 text-red-500">File not found</div>;
    }
  }

  const filename = path.basename(relPath);
  const mimeType = getMimeType(relPath);
  const fileUrl = `/api/files/${params.path.map(encodeURIComponent).join("/")}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ViewerClient
        filename={filename}
        mimeType={mimeType}
        fileUrl={fileUrl}
        relPath={relPath}
      />
    </div>
  );
}
