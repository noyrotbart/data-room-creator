import fs from "fs";
import path from "path";

export const DOCUMENTS_ROOT =
  process.env.DOCUMENTS_PATH ||
  path.join(process.cwd(), "documents_raw", "Data Room");

export interface DocNode {
  name: string;
  path: string; // relative to DOCUMENTS_ROOT, uses "/" separators
  type: "file" | "folder";
  ext?: string;
  children?: DocNode[];
}

const ALLOWED_EXTS = [
  ".pdf", ".xlsx", ".xls", ".docx", ".doc",
  ".csv", ".pptx", ".ppt", ".png", ".jpg", ".jpeg",
];

function readDirRecursive(dir: string, relBase: string): DocNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  entries = entries.filter(
    (e) => !e.name.startsWith(".") && !e.name.startsWith("__MACOSX")
  );

  const nodes: DocNode[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Always use "/" separators in paths stored in DocNode
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = readDirRecursive(fullPath, relPath);
      if (children.length > 0) {
        nodes.push({ name: entry.name, path: relPath, type: "folder", children });
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTS.includes(ext) || ext === "") {
        nodes.push({ name: entry.name, path: relPath, type: "file", ext });
      }
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

/** Read tree from local filesystem (dev) or from the committed manifest (prod). */
export function getDocumentTree(): DocNode[] {
  // In prod (Vercel), no local FS — use the committed manifest
  if (!fs.existsSync(DOCUMENTS_ROOT)) {
    try {
      const manifest = fs.readFileSync(
        path.join(process.cwd(), "public", "manifest.json"),
        "utf-8"
      );
      return JSON.parse(manifest) as DocNode[];
    } catch {
      return [];
    }
  }
  return readDirRecursive(DOCUMENTS_ROOT, "");
}

/** Validate and resolve a relative path to an absolute local path. */
export function resolveDocPath(relPath: string): string {
  // Normalise to OS separators for local FS
  const normalised = relPath.split("/").join(path.sep);
  const resolved = path.resolve(DOCUMENTS_ROOT, normalised);
  if (!resolved.startsWith(path.resolve(DOCUMENTS_ROOT))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return map[ext] ?? "application/octet-stream";
}
