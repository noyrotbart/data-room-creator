/**
 * One-time script to extract text from documents and store in Neon DB.
 * Run with: npx tsx scripts/extract-docs.ts
 *
 * Requires DATABASE_URL to be set in .env.local (or environment).
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// Load .env.local manually for local runs
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const db = neon(process.env.DATABASE_URL);

const DOCS_ROOT = path.join(process.cwd(), "documents_raw", "Data Room");
const CHUNK_SIZE = 1000; // characters per chunk
const OVERLAP = 100;

// ─── Text extractors ──────────────────────────────────────────────────────────

async function extractPdf(filePath: string): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const buf = fs.readFileSync(filePath);
  try {
    const data = await pdfParse(buf);
    return data.text;
  } catch {
    return "";
  }
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = fs.readFileSync(filePath);
  try {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  } catch {
    return "";
  }
}

async function extractXlsx(filePath: string): Promise<string> {
  const XLSXmod = await import("xlsx");
  const XLSX = (XLSXmod as any).default ?? XLSXmod;
  const MAX_CHARS = 200_000; // cap at ~200KB to avoid OOM on large models
  try {
    const wb = XLSX.readFile(filePath);
    const parts: string[] = [];
    let total = 0;
    for (const name of wb.SheetNames as string[]) {
      // Skip internal/temp calculation sheets
      const lower = name.toLowerCase();
      if (lower.startsWith("tmp_") || lower.startsWith("temp_") || lower.startsWith("sheet")) continue;
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws) as string;
      parts.push(`[Sheet: ${name}]\n${csv}`);
      total += csv.length;
      if (total >= MAX_CHARS) break;
    }
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return extractPdf(filePath);
  if (ext === ".docx" || ext === ".doc") return extractDocx(filePath);
  if (ext === ".xlsx" || ext === ".xls") return extractXlsx(filePath);
  if (ext === ".csv") return fs.readFileSync(filePath, "utf-8");
  return "";
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();
  let start = 0;
  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    // Try to break on a word boundary
    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk); // skip tiny chunks
    start = end - OVERLAP;
  }
  return chunks;
}

// ─── Walk directory ───────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("__MACOSX")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...walkDir(full));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if ([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv"].includes(ext)) {
        files.push(full);
      }
    }
  }
  return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`Documents root not found: ${DOCS_ROOT}`);
    process.exit(1);
  }

  // Ensure table exists
  await db(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id SERIAL PRIMARY KEY,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(file_path, chunk_index)
    )
  `);
  await db(`
    CREATE INDEX IF NOT EXISTS idx_chunks_fts
      ON document_chunks USING gin(to_tsvector('english', chunk_text))
  `);

  const files = walkDir(DOCS_ROOT);
  console.log(`Found ${files.length} documents\n`);

  let totalChunks = 0;

  for (const absPath of files) {
    const relPath = path.relative(DOCS_ROOT, absPath).split(path.sep).join("/");
    process.stdout.write(`  ${relPath} … `);

    const text = await extractText(absPath);
    if (!text.trim()) {
      console.log("(no text)");
      continue;
    }

    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      await db(
        `INSERT INTO document_chunks (file_path, chunk_index, chunk_text)
         VALUES ($1, $2, $3)
         ON CONFLICT (file_path, chunk_index) DO UPDATE SET chunk_text = EXCLUDED.chunk_text`,
        [relPath, i, chunks[i]]
      );
    }
    console.log(`${chunks.length} chunks`);
    totalChunks += chunks.length;
  }

  console.log(`\nDone. ${totalChunks} total chunks stored.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
