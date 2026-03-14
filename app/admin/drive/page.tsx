import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isOrgAdmin, getAdminToken } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { Navbar } from "@/components/Navbar";
import { AdminTabs } from "@/components/AdminTabs";
import { DriveClient } from "./DriveClient";

export default async function DrivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");
  const org = await getOrgFromHeaders();
  if (!org) redirect("/");
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) redirect("/browse");

  const hasToken = !!(await getAdminToken("drive_access_token", org.id));

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AdminTabs active="drive" />
        <DriveClient folderId={org.drive_folder_id ?? ""} hasAccessToken={hasToken} />
      </main>
    </div>
  );
}
