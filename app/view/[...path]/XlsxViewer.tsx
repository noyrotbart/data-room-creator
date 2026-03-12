"use client";
import { useEffect, useState } from "react";

interface Sheet {
  name: string;
  html: string;
}

export function XlsxViewer({ fileUrl }: { fileUrl: string }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [XLSX, res] = await Promise.all([
          import("xlsx"),
          fetch(fileUrl),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const wb = XLSX.read(buf, { type: "array" });
        const result: Sheet[] = wb.SheetNames.map((name) => ({
          name,
          html: XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" }),
        }));
        if (!cancelled) {
          setSheets(result);
          setStatus("done");
        }
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? "Unknown error");
          setStatus("error");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fileUrl]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50" style={{ minHeight: "calc(100vh - 112px)" }}>
      {status === "loading" && (
        <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
          <span className="text-sm">Loading spreadsheet…</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center h-48 text-red-400 text-sm">
          Could not render spreadsheet: {errorMsg}
        </div>
      )}
      {status === "done" && sheets.length > 0 && (
        <>
          {/* Sheet tabs */}
          {sheets.length > 1 && (
            <div className="flex gap-1 px-4 pt-3 bg-white border-b border-gray-200 overflow-x-auto">
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setActive(i)}
                  className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                    i === active
                      ? "border-green-600 text-green-700 bg-green-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {/* Sheet content */}
          <div className="flex-1 overflow-auto p-4">
            <div
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto"
              dangerouslySetInnerHTML={{ __html: sheets[active].html }}
            />
          </div>
        </>
      )}
      <style>{`
        .xlsx-table, [class^="xlsx-"] table {
          border-collapse: collapse;
          font-size: 13px;
          font-family: system-ui, sans-serif;
          white-space: nowrap;
        }
        [class^="xlsx-"] td, [class^="xlsx-"] th,
        div[dangerouslysetinnerhtml] table td,
        div[dangerouslysetinnerhtml] table th {
          border: 1px solid #e5e7eb;
          padding: 4px 10px;
          vertical-align: middle;
        }
        div[dangerouslysetinnerhtml] table tr:first-child td,
        div[dangerouslysetinnerhtml] table tr:first-child th {
          background: #f9fafb;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
