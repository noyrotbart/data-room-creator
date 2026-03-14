import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg">Data Room</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-32 text-center">
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Secure document sharing<br />for your organization
        </h1>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          Create a branded data room in minutes. Share documents securely with investors,
          partners, and clients. Track every view with detailed analytics.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg text-base transition-colors shadow-lg">
            Create your Data Room
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature
            title="Google Drive Integration"
            description="Connect your Google Drive folder and documents sync automatically. Supports PDF, DOCX, XLSX, and more."
            icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
          <Feature
            title="Detailed Analytics"
            description="Track who viewed what, for how long. See engagement metrics per document and per user."
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
          <Feature
            title="AI-Powered Chat"
            description="Let users ask questions about your documents with an AI assistant that cites sources."
            icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"
          />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="text-left bg-white/5 rounded-xl p-6 backdrop-blur">
      <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
