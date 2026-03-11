"use client";
import { useState } from "react";
import { DocNode } from "@/lib/documents";
import Link from "next/link";

function fileIcon(ext?: string) {
  if (ext === ".pdf") return "📄";
  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") return "📊";
  if (ext === ".docx" || ext === ".doc") return "📝";
  if (ext === ".pptx" || ext === ".ppt") return "📑";
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") return "🖼️";
  return "📎";
}

function TreeNode({ node, depth = 0 }: { node: DocNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-left"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <span className="text-gray-400 text-xs">{open ? "▼" : "▶"}</span>
          <span className="text-base">📁</span>
          <span className="font-medium truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const encodedPath = node.path.split("/").map(encodeURIComponent).join("/");

  return (
    <Link
      href={`/view/${encodedPath}`}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span className="text-base">{fileIcon(node.ext)}</span>
      <span className="truncate">{node.name}</span>
    </Link>
  );
}

export function DocTree({ nodes }: { nodes: DocNode[] }) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} />
      ))}
    </div>
  );
}
