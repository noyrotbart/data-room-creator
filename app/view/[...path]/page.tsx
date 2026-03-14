import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllowedUserByEmail, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { ViewerClient } from "./ViewerClient";
import { Navbar } from "@/components/Navbar";

export default async function ViewPage({ params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const org = await getOrgFromHeaders();
  const relPath = params.path.map(decodeURIComponent).join("/");
  const filename = relPath.split("/").pop() ?? relPath;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", txt: "text/plain", csv: "text/csv", json: "application/json",
  };
  const mimeType = mimeMap[ext] ?? "application/octet-stream";
  const fileUrl = `/api/files/${encodeURIComponent(relPath)}`;

  let canDownload = false;
  if (org) {
    const admin = await isOrgAdmin(session.user.email, org.id);
    if (admin) {
      canDownload = true;
    } else {
      const user = await getAllowedUserByEmail(session.user.email, org.id);
      canDownload = user?.can_download ?? false;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ViewerClient filename={filename} mimeType={mimeType} fileUrl={fileUrl} relPath={relPath} canDownload={canDownload} />
    </div>
  );
}
