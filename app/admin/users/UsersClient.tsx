"use client";
import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AllowedUserWithActivity } from "@/lib/db";

export function UsersClient({ initialUsers }: { initialUsers: AllowedUserWithActivity[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "warning"; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Password modal state
  const [pwModal, setPwModal] = useState<{ email: string; hasPassword: boolean } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");

  function showToast(type: "success" | "warning", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), durationDays }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        setEmail("");
        setName("");
        setDurationDays(7);
        setShowForm(false);
        await refresh();
        if (j.emailSent) {
          showToast("success", `Invite sent to ${email.trim()}`);
        } else {
          showToast("warning", `Access granted, but email failed: ${j.emailError ?? "unknown error"}`);
        }
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to grant access");
      }
    });
  }

  async function handleRevoke(userEmail: string) {
    startTransition(async () => {
      await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}`, { method: "DELETE" });
      await refresh();
    });
  }

  async function handleRegrant(userEmail: string) {
    startTransition(async () => {
      await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}`, { method: "PUT" });
      await refresh();
    });
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwModal) return;
    setPwError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(pwModal.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      if (res.ok) {
        setPwModal(null);
        setPwValue("");
        showToast("success", pwValue ? `Password set for ${pwModal.email}` : `Password cleared for ${pwModal.email}`);
        await refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setPwError(j.error ?? "Failed to set password");
      }
    });
  }

  const active = users.filter((u) => !u.revoked_at);
  const revoked = users.filter((u) => u.revoked_at);

  // Sort active: never-opened first, then by last_seen desc
  const activeSorted = [...active].sort((a, b) => {
    if (!a.last_seen && b.last_seen) return -1;
    if (a.last_seen && !b.last_seen) return 1;
    if (!a.last_seen && !b.last_seen) return 0;
    return new Date(b.last_seen!).getTime() - new Date(a.last_seen!).getTime();
  });

  const neverOpenedCount = active.filter((u) => !u.view_count).length;

  return (
    <div>
      {/* Password modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {pwModal.hasPassword ? "Reset password" : "Set password"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">{pwModal.email}</p>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              <div className="flex gap-2 justify-end">
                {pwModal.hasPassword && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!pwModal) return;
                      startTransition(async () => {
                        const res = await fetch(`/api/admin/users/${encodeURIComponent(pwModal.email)}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ password: null }),
                        });
                        if (res.ok) {
                          setPwModal(null);
                          setPwValue("");
                          showToast("success", `Password cleared for ${pwModal.email}`);
                          await refresh();
                        }
                      });
                    }}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 mr-auto"
                  >
                    Clear password
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setPwModal(null); setPwValue(""); setPwError(""); }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || pwValue.length < 8}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-sm
          ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <span className="text-base">{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            {active.length} active
            {neverOpenedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {neverOpenedCount} never opened
              </span>
            )}
            {revoked.length > 0 && (
              <span className="ml-2 text-gray-400">· {revoked.length} revoked</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <form
          onSubmit={handleGrant}
          className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6"
        >
          <h2 className="text-sm font-semibold text-blue-900 mb-4">Invite a new user</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <input
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 7))}
                className="w-12 text-sm text-center focus:outline-none"
              />
              <span className="text-sm text-gray-400">days</span>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {isPending ? "Saving…" : "Invite"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>
      )}

      {/* Active users */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Active invites</h2>
        </div>
        {activeSorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No users have been invited yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">Time spent</th>
                  <th className="px-5 py-3 text-right">Last seen</th>
                  <th className="px-5 py-3 text-right">Invited</th>
                  <th className="px-5 py-3 text-right">Expires</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeSorted.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{u.name ?? u.email}</div>
                      {u.name && <div className="text-xs text-gray-400">{u.email}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {!u.view_count ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Never opened
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">
                      {u.view_count || "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">
                      {formatDuration(u.total_seconds)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">
                      {u.last_seen
                        ? formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">
                      {formatDistanceToNow(new Date(u.granted_at), { addSuffix: true })}
                    </td>
                    <td className="px-5 py-3 text-right text-xs">
                      <ExpiryBadge expiresAt={u.expires_at} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => { setPwModal({ email: u.email, hasPassword: !!u.password_hash }); setPwValue(""); setPwError(""); }}
                          disabled={isPending}
                          className="text-xs text-gray-400 hover:text-blue-600 disabled:opacity-50 font-medium"
                          title={u.password_hash ? "Reset password" : "Set password"}
                        >
                          {u.password_hash ? "🔑 Reset pw" : "Set pw"}
                        </button>
                        <button
                          onClick={() => handleRevoke(u.email)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoked users */}
      {revoked.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-400">Removed</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 text-right">Views</th>
                <th className="px-5 py-3 text-right">Removed</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {revoked.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 opacity-60">
                  <td className="px-5 py-3 text-gray-500 line-through">{u.email}</td>
                  <td className="px-5 py-3 text-gray-400">{u.name ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{u.view_count || "—"}</td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(u.revoked_at!), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRegrant(u.email)}
                      disabled={isPending}
                      className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 font-medium"
                    >
                      Re-invite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-gray-300">No limit</span>;
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 text-xs font-medium px-2 py-0.5 rounded-full">
      Expired
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs font-medium px-2 py-0.5 rounded-full">
      {days}d left
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-2 py-0.5 rounded-full">
      {days}d left
    </span>
  );
  return <span className="text-gray-400">{days}d left</span>;
}

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
