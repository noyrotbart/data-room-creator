import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllowedUsersWithActivity } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { AdminTabs } from "@/components/AdminTabs";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (!isAdmin(session.user?.email)) redirect("/browse");

  const users = await getAllowedUsersWithActivity();

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
