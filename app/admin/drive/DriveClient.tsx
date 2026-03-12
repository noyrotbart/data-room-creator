"use client";
import { useState, useRef } from "react";

interface LogEntry {
  type: "start" | "progress" | "done" | "error";
  message: string;
  filesProcessed?: number;
  chunksStored?: number;
}

interface Props {
  folderId: string | null;
  hasAccessToken: boolean;
}

export function DriveClient({ folderId, hasAccessToken }: Props) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<{
    filesProcessed: number;
    chunksStored: number;
  } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  async function startSync() {
    setRunning(true);
    setLog([]);
    setResult(null);

    try {
      const res = await fetch("/api/admin/sync-drive", { method: "POST" });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setLog([{ type: "error", message: err.error ?? "Sync failed" }]);
        setRunning(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const entry = JSON.parse(line.slice(6)) as LogEntry;
            setLog((prev) => [...prev, entry]);
            if (entry.type === "done" && entry.filesProcessed != null) {
              setResult({
                filesProcessed: entry.filesProcessed,
                chunksStored: entry.chunksStored ?? 0,
              });
            }
            // Auto-scroll log
            setTimeout(() => {
              logRef.current?.scrollTo({
                top: logRef.current.scrollHeight,
                behavior: "smooth",
              });
            }, 50);
          } catch {}
        }
      }
    } catch (err: any) {
      setLog((prev) => [
        ...prev,
        { type: "error", message: err.message ?? "Network error" },
      ]);
    } finally {
      setRunning(false);
    }
  }

  if (!folderId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
        <p className="font-medium mb-1">GOOGLE_DRIVE_FOLDER_ID not configured</p>
        <p>Add this environment variable to your Vercel project and redeploy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Folder info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Connected Drive Folder
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Folder ID: <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">{folderId}</code>
            </p>
            <a
              href={`https://drive.google.com/drive/folders/${folderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Open in Google Drive →
            </a>
          </div>
        </div>
      </div>

      {/* Token warning */}
      {!hasAccessToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <p className="font-medium mb-2">Google Drive not connected</p>
          <p className="mb-3">
            Connect your Google account to grant read-only Drive access for syncing documents.
          </p>
          <a
            href="/api/admin/drive-connect"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Drive
          </a>
        </div>
      )}

      {/* Sync button + result */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Sync Documents to Chat
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Extracts text from all Drive documents and updates the chat search index.
              PDFs, Google Docs, Sheets, and DOCX/XLSX files are supported.
            </p>
          </div>
          <button
            onClick={startSync}
            disabled={running || !hasAccessToken}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync from Drive
              </>
            )}
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Sync complete — {result.filesProcessed} files processed, {result.chunksStored} chunks stored in chat index.
          </div>
        )}

        {/* Log output */}
        {log.length > 0 && (
          <div
            ref={logRef}
            className="bg-gray-950 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-0.5"
          >
            {log.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.type === "error"
                    ? "text-red-400"
                    : entry.type === "done"
                    ? "text-green-400 font-semibold"
                    : entry.type === "start"
                    ? "text-blue-400"
                    : "text-gray-300"
                }
              >
                {entry.message}
              </div>
            ))}
            {running && (
              <div className="text-gray-500 animate-pulse">▊</div>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
        <p className="font-medium mb-2">How Drive Sync works</p>
        <ul className="space-y-1 text-blue-800 list-disc list-inside">
          <li>Recursively walks the entire Drive folder</li>
          <li>Extracts text from Google Docs, Sheets, PDFs, DOCX, XLSX and CSV files</li>
          <li>Chunks text and upserts into the chat search database</li>
          <li>Existing chunks for the same file are updated (safe to run again)</li>
          <li>Run this whenever you add or update documents in Drive</li>
        </ul>
      </div>
    </div>
  );
}
