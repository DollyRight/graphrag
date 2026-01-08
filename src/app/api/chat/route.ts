// src/app/api/chat/route.ts
import { graphRagQuery } from "@/lib/graph-rag";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages,kbId } = await req.json();

  const lastMessage = messages[messages.length - 1].content;
  console.log("kbId",kbId)
  const stream = await graphRagQuery(lastMessage,`kb_${kbId}`);
  const responseStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}