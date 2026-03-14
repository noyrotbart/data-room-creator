"use client";
import { useEffect, useState } from "react";

interface Sheet {
  name: string;
  rows: string[][];
  colWidths: number[];
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
        const [XLSX, res] = await Promise.all([import("xlsx"), fetch(fileUrl)]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const result: Sheet[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
            header: 1,
            raw: false,
            defval: "",
          }) as string[][];
          const cols: any[] = (ws["!cols"] as any[]) ?? [];
          const colWidths = cols.map((c) =>
            c?.wpx ? Math.max(c.wpx, 60) : c?.wch ? Math.max(Math.round(c.wch * 7), 60) : 90
          );
          return { name, rows, colWidths };
        });
        if (!cancelled) { setSheets(result); setStatus("done"); }
      } catch (e: any) {
        if (!cancelled) { setErrorMsg(e?.message ?? "Unknown error"); setStatus("error"); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fileUrl]);

  const sheet = sheets[active];

  return (
    <div className="flex-1 flex flex-col bg-gray-100" style={{ minHeight: "calc(100vh - 112px)" }}>
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
      {status === "done" && sheet && (
        <>
          {sheets.length > 1 && (
            <div className="flex gap-1 px-4 pt-3 bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
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
          <div className="flex-1 overflow-auto">
            <table style={{
              borderCollapse: "collapse",
              fontSize: "13px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
              width: "max-content",
              minWidth: "100%",
            }}>
              {sheet.rows[0] && (
                <thead>
                  <tr>
                    {sheet.rows[0].map((cell, j) => (
                      <th key={j} style={{
                        border: "1px solid #d1d5db",
                        padding: "7px 12px",
                        background: "#f3f4f6",
                        fontWeight: 600,
                        textAlign: "left",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        minWidth: `${sheet.colWidths[j] ?? 90}px`,
                        color: "#111827",
                        boxShadow: "0 1px 0 #d1d5db",
                      }}>
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {sheet.rows.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        border: "1px solid #e5e7eb",
                        padding: "5px 12px",
                        background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                        minWidth: `${sheet.colWidths[j] ?? 90}px`,
                        color: "#374151",
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
