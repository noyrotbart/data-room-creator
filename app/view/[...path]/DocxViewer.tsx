"use client";
import { useEffect, useRef, useState } from "react";

export function DocxViewer({ fileUrl }: { fileUrl: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const [{ renderAsync }, res] = await Promise.all([
          import("docx-preview"),
          fetch(fileUrl),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled || !bodyRef.current) return;
        await renderAsync(blob, bodyRef.current, undefined, {
          className: "docx-body",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: true,
        });
        if (!cancelled) setStatus("done");
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? "Unknown error");
          setStatus("error");
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [fileUrl]);

  return (
    <div className="flex-1 overflow-auto bg-gray-200" style={{ minHeight: "calc(100vh - 112px)" }}>
      {status === "loading" && (
        <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          <span className="text-sm">Rendering document…</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center h-48 text-red-400 text-sm">
          Could not render document: {errorMsg}
        </div>
      )}
      <div
        ref={bodyRef}
        className={status !== "done" ? "hidden" : ""}
        style={{ padding: "24px 0" }}
      />
      <style>{`
        .docx-body section.docx {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          margin: 0 auto 24px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
