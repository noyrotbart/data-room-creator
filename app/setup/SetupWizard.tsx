"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";

interface SetupWizardProps {
  orgId: number;
  orgSlug: string;
  orgName: string;
  hasToken: boolean;
  hasDriveFolder: boolean;
}

export default function SetupWizard({ orgId, orgSlug, orgName, hasToken, hasDriveFolder }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(orgName);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveBranding() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/org-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl, primaryColor }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setStep(2);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Customize your data room</h2>
            <p className="text-sm text-gray-500 mb-6">Set your organization's branding</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.svg"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {logoUrl && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <img src={logoUrl} alt="Logo preview" className="h-8 object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <button
              onClick={saveBranding}
              disabled={saving}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saving…" : "Save & Continue"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connect Google Drive</h2>
            <p className="text-sm text-gray-500 mb-6">Link a Google Drive folder to serve as your document library</p>

            {hasToken ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 text-sm font-medium">Google Drive is connected!</p>
              </div>
            ) : (
              <a
                href="/api/admin/drive-connect"
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 19.5h20L12 2z" fill="#4285F4" opacity="0.8"/>
                  <path d="M2 19.5l5-8.5h10l5 8.5H2z" fill="#0F9D58" opacity="0.8"/>
                  <path d="M17 11L12 2l-5 8.5h10z" fill="#FBBC04" opacity="0.8"/>
                </svg>
                Connect Google Drive
              </a>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
              >
                {hasToken ? "Continue" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your data room is ready. You can now invite users, sync documents from Drive, and start sharing.
            </p>
            <div className="space-y-3">
              <a
                href="/admin/users"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors text-center"
              >
                Invite your first users
              </a>
              <a
                href="/browse"
                className="block w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg text-sm transition-colors text-center"
              >
                Go to Data Room
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
