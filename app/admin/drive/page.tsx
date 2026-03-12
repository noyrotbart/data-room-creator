import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AdminTabs } from "@/components/AdminTabs";
import { DriveClient } from "./DriveClient";

export default async function DrivePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (!isAdmin(session.user?.email)) redirect("/browse");

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? null;
  const hasAccessToken = !!(session as any).accessToken;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <AdminTabs active="drive" />
        <DriveClient folderId={folderId} hasAccessToken={hasAccessToken} />
      </main>
    </div>
  );
}
