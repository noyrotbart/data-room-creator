import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllowedUserByEmail, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import ViewerClient from "./ViewerClient";
import { Navbar } from "@/components/Navbar";

export default async function ViewPage({ params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const org = await getOrgFromHeaders();
  const relPath = params.path.map(decodeURIComponent).join("/");
  const filename = relPath.split("/").pop() ?? relPath;

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
      <ViewerClient filePath={relPath} filename={filename} canDownload={canDownload} />
    </div>
  );
}
