"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { DocxViewer } from "./DocxViewer";
import { XlsxViewer } from "./XlsxViewer";

interface Props {
  filename: string;
  mimeType: string;
  fileUrl: string;
  relPath: string;
}

export function ViewerClient({ filename, mimeType, fileUrl, relPath }: Props) {
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();

    function reportDuration() {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      if (seconds < 2) return;
      // sendBeacon fires even when the tab is being closed
      navigator.sendBeacon(
        "/api/views/duration",
        new Blob([JSON.stringify({ filePath: relPath, durationSeconds: seconds })], {
          type: "application/json",
        })
      );
    }

    window.addEventListener("beforeunload", reportDuration);
    return () => {
      window.removeEventListener("beforeunload", reportDuration);
      reportDuration(); // also fires on in-app navigation (React unmount)
    };
  }, [relPath]);
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword";
  const isXlsx =
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv";

  const parts = relPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href="/browse" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-gray-500 min-w-0 flex-1">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-gray-300">/</span>}
              <span className={i === parts.length - 1 ? "text-gray-900 font-medium truncate" : "truncate"}>
                {part}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Viewer */}
      <div className="flex-1 flex flex-col">
        {isPdf && (
          <iframe
            src={fileUrl}
            className="flex-1 w-full"
            style={{ minHeight: "calc(100vh - 112px)" }}
            title={filename}
          />
        )}
        {isImage && (
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-800">
            <img src={fileUrl} alt={filename} className="max-w-full max-h-full object-contain shadow-2xl" />
          </div>
        )}
        {isDocx && <DocxViewer fileUrl={fileUrl} />}
        {isXlsx && <XlsxViewer fileUrl={fileUrl} />}
        {!isPdf && !isImage && !isDocx && !isXlsx && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-800 text-white gap-3">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-white/60 text-sm">{filename} cannot be previewed in the browser.</p>
          </div>
        )}
      </div>
    </div>
  );
}
