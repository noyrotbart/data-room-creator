"use client";
import Link from "next/link";

interface Props {
  filename: string;
  mimeType: string;
  fileUrl: string;
  relPath: string;
}

export function ViewerClient({ filename, mimeType, fileUrl, relPath }: Props) {
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isViewable = isPdf || isImage;

  // Breadcrumb from path
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
        <a
          href={fileUrl}
          download={filename}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>

      {/* Viewer */}
      <div className="flex-1 bg-gray-800 flex flex-col">
        {isPdf && (
          <iframe
            src={fileUrl}
            className="flex-1 w-full"
            style={{ minHeight: "calc(100vh - 120px)" }}
            title={filename}
          />
        )}
        {isImage && (
          <div className="flex-1 flex items-center justify-center p-8">
            <img src={fileUrl} alt={filename} className="max-w-full max-h-full object-contain shadow-2xl" />
          </div>
        )}
        {!isViewable && (
          <div className="flex-1 flex flex-col items-center justify-center text-white gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium mb-1">{filename}</p>
              <p className="text-white/50 text-sm mb-4">This file type cannot be previewed in the browser.</p>
              <a
                href={fileUrl}
                download={filename}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {filename}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
