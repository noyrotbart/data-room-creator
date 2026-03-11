import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getViewsByFile, getViewsByUser, getRecentViews } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { formatDistanceToNow } from "date-fns";
import path from "path";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (!isAdmin(session.user?.email)) redirect("/browse");

  const [byUser, byFile, recent] = await Promise.all([
    getViewsByUser(),
    getViewsByFile(),
    getRecentViews(100),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total views" value={recent.length} />
          <StatCard label="Unique visitors" value={byUser.length} />
          <StatCard label="Documents viewed" value={byFile.length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Visitors */}
          <Section title="Visitors">
            {byUser.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                    <th className="pb-2">User</th>
                    <th className="pb-2 text-right">Views</th>
                    <th className="pb-2 text-right">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((u) => (
                    <tr key={u.user_email} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5">
                        <div className="font-medium text-gray-900">{u.user_name ?? u.user_email}</div>
                        {u.user_name && (
                          <div className="text-xs text-gray-400">{u.user_email}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium">{u.count}</td>
                      <td className="py-2.5 text-right text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Documents */}
          <Section title="Most viewed documents">
            {byFile.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                    <th className="pb-2">Document</th>
                    <th className="pb-2 text-right">Views</th>
                    <th className="pb-2 text-right">Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {byFile.map((f) => (
                    <tr key={f.file_path} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 max-w-xs">
                        <div className="font-medium text-gray-900 truncate">
                          {path.basename(f.file_path)}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{path.dirname(f.file_path)}</div>
                      </td>
                      <td className="py-2.5 text-right font-medium">{f.count}</td>
                      <td className="py-2.5 text-right text-gray-400">{f.unique_viewers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        {/* Activity feed */}
        <Section title="Recent activity">
          {recent.length === 0 ? (
            <Empty />
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map((v) => (
                <div key={v.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    {(v.user_name ?? v.user_email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{v.user_name ?? v.user_email}</span>
                      {" viewed "}
                      <span className="font-medium text-blue-700">{path.basename(v.file_path)}</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">{v.file_path}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-400 text-center py-4">No data yet</p>;
}
