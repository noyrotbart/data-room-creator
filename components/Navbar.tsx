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
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <Link href="/browse" className="font-semibold text-gray-900">Data Room</Link>
      </div>

      <div className="flex items-center gap-4">
        {showAdmin && (
          <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
            Analytics
          </Link>
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
