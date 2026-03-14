import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

export async function Navbar() {
  const session = await getServerSession(authOptions);
  const showAdmin = isAdmin(session?.user?.email);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src="https://cdn.prod.website-files.com/67a1af244a7d949c40e22a28/67a1cb65b38d5e2aa20b616e_Logo.svg"
          alt="Churney"
          className="h-8"
        />
        <Link href="/browse" className="font-semibold text-gray-900">Churney</Link>
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
            <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
              Analytics
            </Link>
            <Link href="/admin/users" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
              Users
            </Link>
          </>
        )}
        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-sm text-gray-600 hidden sm:block">{session.user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
