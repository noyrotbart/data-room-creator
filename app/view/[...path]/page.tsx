import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { resolveDocPath, getMimeType, DOCUMENTS_ROOT } from "@/lib/documents";
import { Navbar } from "@/components/Navbar";
import { getAllowedUserByEmail } from "@/lib/db";
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

  // Admins can always download; regular users need the flag
  const canDownload = isAdmin(session.user?.email)
    ? true
    : ((await getAllowedUserByEmail(session.user?.email ?? ""))?.can_download ?? false);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ViewerClient
        filename={filename}
        mimeType={mimeType}
        fileUrl={fileUrl}
        relPath={relPath}
        canDownload={canDownload}
      />
    </div>
  );
}
