import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchChunks } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrgFromHeaders();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  let body: { messages?: { role: string; content: string }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "No user message" }, { status: 400 });

  let chunks: Awaited<ReturnType<typeof searchChunks>> = [];
  try { chunks = await searchChunks(lastUser.content, org.id, 8); } catch {}

  const seen = new Set<string>();
  const sources = chunks.map((c) => c.file_path).filter((p) => (seen.has(p) ? false : (seen.add(p), true)));

  const contextBlock = chunks.length > 0
    ? chunks.map((c, i) => `[${i + 1}] File: ${c.file_path}\n${c.chunk_text}`).join("\n\n---\n\n")
    : "No relevant document excerpts found.";

  const systemPrompt = `You are a helpful assistant for the ${org.name} data room.
Answer the user's question using only the document excerpts provided below.
Always mention which document(s) your answer comes from.
If the information is not in the excerpts, say you don't have that information in the data room.
Be concise and professional.

DOCUMENT EXCERPTS:
${contextBlock}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (sources.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`));
        }
        const anthropicStream = await anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        });
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`));
      } finally { controller.close(); }
    },
  });

  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
