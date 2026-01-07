// src/app/api/chat/route.ts
import { graphRagQuery } from "@/lib/graph-rag";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  const stream = await graphRagQuery(lastMessage);

  // 将 LangChain 的流转换为 Web Standard Stream
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