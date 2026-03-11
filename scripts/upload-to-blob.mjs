/**
 * Upload all documents to Vercel Blob storage.
 * Run once: node scripts/upload-to-blob.mjs
 *
 * Requires: BLOB_READ_WRITE_TOKEN in .env.local
 */
import { put, list } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .forEach((l) => {
      const [k, ...v] = l.split("=");
      if (k && v.length) process.env[k.trim()] = v.join("=").trim();
    });
}

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN not found in .env.local");
  process.exit(1);
}

const DOCUMENTS_PATH =
  process.env.DOCUMENTS_PATH ||
  path.join(__dirname, "../documents_raw/Data Room");

if (!fs.existsSync(DOCUMENTS_PATH)) {
  console.error("Documents folder not found:", DOCUMENTS_PATH);
  process.exit(1);
}

const ALLOWED = new Set([
  ".pdf", ".xlsx", ".xls", ".docx", ".doc",
  ".csv", ".pptx", ".ppt", ".png", ".jpg", ".jpeg",
]);

function collectFiles(dir, relBase = "") {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED.has(ext) || ext === "") result.push({ fullPath, relPath });
    }
  }
  return result;
}

const files = collectFiles(DOCUMENTS_PATH);
console.log(`Found ${files.length} files to upload.\n`);

// Check already-uploaded blobs
const existing = new Set();
let cursor;
do {
  const res = await list({ token: TOKEN, prefix: "documents/", cursor });
  for (const b of res.blobs) existing.add(b.pathname);
  cursor = res.cursor;
} while (cursor);

let uploaded = 0;
let skipped = 0;

for (const { fullPath, relPath } of files) {
  const blobKey = `documents/${relPath}`;
  if (existing.has(blobKey)) {
    console.log(`  skip  ${relPath}`);
    skipped++;
    continue;
  }
  const content = fs.readFileSync(fullPath);
  await put(blobKey, content, { token: TOKEN, access: "public", addRandomSuffix: false });
  console.log(`  ok    ${relPath}`);
  uploaded++;
}

console.log(`\nDone: ${uploaded} uploaded, ${skipped} already existed.`);
