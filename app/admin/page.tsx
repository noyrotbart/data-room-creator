import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getViewsByFile, getViewsByUser, getRecentViews, getAllowedUsersWithActivity, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { Navbar } from "@/components/Navbar";
import { AdminTabs } from "@/components/AdminTabs";
import { formatDistanceToNow } from "date-fns";
import path from "path";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");
  const org = await getOrgFromHeaders();
  if (!org) redirect("/");
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) redirect("/browse");

  const [byUser, byFile, recent, allUsers] = await Promise.all([
    getViewsByUser(org.id),
    getViewsByFile(org.id),
    getRecentViews(org.id, 100),
    getAllowedUsersWithActivity(org.id),
  ]);

  const neverOpened = allUsers.filter((u) => !u.revoked_at && !u.view_count);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AdminTabs active="analytics" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total views" value={recent.length} />
          <StatCard label="Unique visitors" value={byUser.length} />
          <StatCard label="Documents viewed" value={byFile.length} />
          <StatCard label="Never opened" value={neverOpened.length} highlight={neverOpened.length > 0} href="/admin/users" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Section title="Visitors">
            {byUser.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                  <th className="pb-2">User</th><th className="pb-2 text-right">Views</th>
                  <th className="pb-2 text-right">Total time</th><th className="pb-2 text-right">Last seen</th>
                </tr></thead>
                <tbody>{byUser.map((u: any) => (
                  <tr key={u.user_email} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5"><div className="font-medium text-gray-900">{u.user_name ?? u.user_email}</div>
                      {u.user_name && <div className="text-xs text-gray-400">{u.user_email}</div>}</td>
                    <td className="py-2.5 text-right font-medium">{u.count}</td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">{formatDuration(u.total_seconds)}</td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">{formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>
          <Section title="Most viewed documents">
            {byFile.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                  <th className="pb-2">Document</th><th className="pb-2 text-right">Views</th>
                  <th className="pb-2 text-right">Unique</th><th className="pb-2 text-right">Avg time</th>
                </tr></thead>
                <tbody>{byFile.map((f: any) => (
                  <tr key={f.file_path} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 max-w-xs"><div className="font-medium text-gray-900 truncate">{path.basename(f.file_path)}</div>
                      <div className="text-xs text-gray-400 truncate">{path.dirname(f.file_path)}</div></td>
                    <td className="py-2.5 text-right font-medium">{f.count}</td>
                    <td className="py-2.5 text-right text-gray-400">{f.unique_viewers}</td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">{formatDuration(f.avg_seconds)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>
        </div>
        <Section title="Recent activity">
          {recent.length === 0 ? <Empty /> : (
            <div className="divide-y divide-gray-50">
              {recent.map((v: any) => (
                <div key={v.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    {(v.user_name ?? v.user_email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{v.user_name ?? v.user_email}</span>{" viewed "}
                      <span className="font-medium text-blue-700">{path.basename(v.file_path)}</span>
                      {v.duration_seconds != null && v.duration_seconds > 0 && (
                        <span className="text-gray-400">{" for "}<span className="text-gray-600">{formatDuration(v.duration_seconds)}</span></span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{v.file_path}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60); const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60); const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function StatCard({ label, value, highlight, href }: { label: string; value: number; highlight?: boolean; href?: string }) {
  const inner = (
    <div className={`rounded-xl border p-5 transition-colors ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"} ${href ? "cursor-pointer hover:shadow-sm" : ""}`}>
      <p className={`text-sm mb-1 ${highlight ? "text-amber-700" : "text-gray-500"}`}>{label}</p>
      <p className={`text-3xl font-bold ${highlight ? "text-amber-800" : "text-gray-900"}`}>{value}</p>
      {href && <p className={`text-xs mt-1 ${highlight ? "text-amber-600" : "text-gray-400"}`}>Manage →</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>{action}
      </div>
      {children}
    </div>
  );
}

function Empty() { return <p className="text-sm text-gray-400 text-center py-4">No data yet</p>; }
