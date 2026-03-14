import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

export async function Navbar() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  const showAdmin = org && session?.user?.email ? await isOrgAdmin(session.user.email, org.id) : false;

  const orgName = org?.name ?? "Data Room";
  const logoUrl = org?.logo_url;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={orgName} className="h-8" />
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        <Link href="/browse" className="font-semibold text-gray-900">{orgName}</Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/chat" className="text-sm text-gray-600 hover:text-blue-700 font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
          </svg>
          Chat
        </Link>
        {showAdmin && (
          <>
            <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800 font-medium">Analytics</Link>
            <Link href="/admin/users" className="text-sm text-purple-600 hover:text-purple-800 font-medium">Users</Link>
          </>
        )}
        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />}
            <span className="text-sm text-gray-600 hidden sm:block">{session.user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
