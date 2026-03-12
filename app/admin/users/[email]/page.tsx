import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
  getAllowedUserByEmail,
  getViewsForUser,
} from "@/lib/db";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function fileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function fileFolder(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join(" / ");
}

export default async function UserDetailPage({
  params,
}: {
  params: { email: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (!isAdmin(session.user?.email)) redirect("/browse");

  const email = decodeURIComponent(params.email);
  const [user, activity] = await Promise.all([
    getAllowedUserByEmail(email),
    getViewsForUser(email),
  ]);

  const { byDocument, recent } = activity;

  const totalViews = byDocument.reduce((s, d) => s + d.view_count, 0);
  const totalSeconds = byDocument.reduce(
    (s, d) => s + (d.total_seconds ?? 0),
    0
  );
  const isActive = user ? !user.revoked_at : false;
  const isExpired =
    user?.expires_at ? new Date(user.expires_at) < new Date() : false;

  const initials = (user?.name ?? email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Back link */}
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </Link>

        {/* User header card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {user?.name ?? email}
                </h1>
                {user && (
                  isExpired ? (
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Expired
                    </span>
                  ) : !isActive ? (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Revoked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )
                )}
              </div>
              {user?.name && (
                <p className="text-sm text-gray-500 mt-0.5">{email}</p>
              )}
              {user && (
                <p className="text-xs text-gray-400 mt-1">
                  Invited {formatDistanceToNow(new Date(user.granted_at), { addSuffix: true })}
                  {user.expires_at && (
                    <span className="ml-2">
                      · Expires {format(new Date(user.expires_at), "MMM d, yyyy")}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalViews || "0"}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total views</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {byDocument.length || "0"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Documents accessed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(totalSeconds) === "—" ? "0s" : formatDuration(totalSeconds)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Total time spent</p>
            </div>
          </div>
        </div>

        {byDocument.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">This user hasn't opened any documents yet.</p>
          </div>
        ) : (
          <>
            {/* Per-document breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Documents viewed</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sorted by most recently viewed</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50">
                      <th className="px-5 py-3">Document</th>
                      <th className="px-5 py-3 text-right">Views</th>
                      <th className="px-5 py-3 text-right">Time spent</th>
                      <th className="px-5 py-3 text-right">First seen</th>
                      <th className="px-5 py-3 text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {byDocument.map((doc) => (
                      <tr key={doc.file_path} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 leading-tight">
                            {fileName(doc.file_path)}
                          </p>
                          {fileFolder(doc.file_path) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fileFolder(doc.file_path)}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-700">
                          {doc.view_count}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 font-medium">
                          {formatDuration(doc.total_seconds)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400 text-xs">
                          {formatDistanceToNow(new Date(doc.first_viewed), { addSuffix: true })}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400 text-xs">
                          {formatDistanceToNow(new Date(doc.last_viewed), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Recent activity</h2>
                <p className="text-xs text-gray-400 mt-0.5">Individual view events (most recent first)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {recent.map((v) => (
                  <div key={v.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">
                        {fileName(v.file_path)}
                      </p>
                      {fileFolder(v.file_path) && (
                        <p className="text-xs text-gray-400 truncate">{fileFolder(v.file_path)}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {v.duration_seconds != null && v.duration_seconds > 0 && (
                        <p className="text-sm font-medium text-gray-700">
                          {formatDuration(v.duration_seconds)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {format(new Date(v.viewed_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
