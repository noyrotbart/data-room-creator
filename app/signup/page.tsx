"use client";
import { useState } from "react";

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleOrgNameChange(val: string) {
    setOrgName(val);
    // Auto-generate slug from org name
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    setSlug(autoSlug);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, slug, adminEmail, adminPassword, adminName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      // Redirect to the new org's setup page
      window.location.href = data.orgUrl;
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your Data Room</h1>
          <p className="text-gray-500 mt-2 text-sm">Set up a secure document sharing space for your organization</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
            <input
              type="text"
              required
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
            <div className="flex items-center">
              <input
                type="text"
                required
                placeholder="acme"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg px-3 py-2.5 text-sm text-gray-500">
                .{typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "dataroom.io") : "dataroom.io"}
              </span>
            </div>
          </div>

          <hr className="my-2" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin account</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
            <input
              type="email"
              required
              placeholder="jane@acme.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? "Creating…" : "Create Data Room"}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-400 text-center">
          You'll be able to connect Google Drive, customize branding, and invite users after setup.
        </p>
      </div>
    </div>
  );
}
