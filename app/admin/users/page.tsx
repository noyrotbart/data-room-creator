import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllowedUsersWithActivity, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { Navbar } from "@/components/Navbar";
import { AdminTabs } from "@/components/AdminTabs";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");
  const org = await getOrgFromHeaders();
  if (!org) redirect("/");
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) redirect("/browse");

  const users = await getAllowedUsersWithActivity(org.id);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <AdminTabs active="users" />
        <UsersClient initialUsers={users} />
      </main>
    </div>
  );
}
