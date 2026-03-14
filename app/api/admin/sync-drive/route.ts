import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upsertChunks, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { listFolder, extractDriveText, isTextExtractable, MIME_FOLDER, getAdminDriveAccessToken } from "@/lib/drive";

export const maxDuration = 300;

const CHUNK_SIZE = 1000;
const OVERLAP = 100;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();
  let start = 0;
  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - OVERLAP;
  }
  return chunks;
}

async function syncFolder(folderId: string, folderPath: string, accessToken: string, orgId: number, send: (msg: object) => void) {
  const items = await listFolder(folderId, accessToken);
  let files = 0, chunks = 0;
  for (const item of items) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.mimeType === MIME_FOLDER) {
      const sub = await syncFolder(item.id, itemPath, accessToken, orgId, send);
      files += sub.files; chunks += sub.chunks; continue;
    }
    if (!isTextExtractable(item.mimeType)) continue;
    try {
      send({ type: "progress", message: `Processing: ${itemPath}` });
      const text = await extractDriveText(item, accessToken);
      if (!text.trim()) { send({ type: "progress", message: `  → no text extracted` }); continue; }
      const textChunks = chunkText(text);
      if (!textChunks.length) continue;
      await upsertChunks(textChunks.map((t, i) => ({ filePath: itemPath, chunkIndex: i, chunkText: t })), orgId);
      files++; chunks += textChunks.length;
      send({ type: "progress", message: `  → ${textChunks.length} chunks stored` });
    } catch (err: any) {
      send({ type: "error", message: `Error processing ${itemPath}: ${err.message}` });
    }
  }
  return { files, chunks };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

  const accessToken = await getAdminDriveAccessToken(org.id);
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Google Drive not connected." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const folderId = org.drive_folder_id;
  if (!folderId) {
    return new Response(JSON.stringify({ error: "No Drive folder configured for this organization." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
      try {
        send({ type: "start", message: "Starting Drive sync…" });
        const { files, chunks } = await syncFolder(folderId, "", accessToken, org.id, send);
        send({ type: "done", message: `Sync complete. ${files} files processed, ${chunks} chunks stored.`, filesProcessed: files, chunksStored: chunks });
      } catch (err: any) {
        send({ type: "error", message: `Sync failed: ${err.message}` });
      } finally { controller.close(); }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
