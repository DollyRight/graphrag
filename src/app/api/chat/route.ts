// import { NextRequest, NextResponse } from "next/server";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
// import { ChatOpenAI } from "@langchain/openai";
// // import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";
// import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
// import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

// export async function POST(req: NextRequest) {
//     try {
//         const { messages } = await req.json();

//         const model = new ChatOpenAI({
//             openAIApiKey: process.env.OPENAI_API_KEY,
//             modelName: "qwen-long-latest",
//             temperature: 0.7,
//             streaming: true, // 开启流式
//             configuration: {
//                 baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
//             }
//         });

//         const langChainMessages: BaseMessage[] = messages.map((m: any) => {
//             const content = m.content || "";
//             if (m.role === "user") return new HumanMessage(content);
//             if (m.role === "assistant") return new AIMessage(content);
//             if (m.role === "system") return new SystemMessage(content);
//             return new HumanMessage(content);
//         });

//         // 使用流式输出
//         const stream = await model.stream(langChainMessages);

//         // 将 LangChain 的流转换为 TextEncoder 流返回给前端
//         const encoder = new TextEncoder();
//         const readableStream = new ReadableStream({
//             async start(controller) {
//                 for await (const chunk of stream) {
//                     controller.enqueue(encoder.encode(chunk.content as string));
//                 }
//                 controller.close();
//             },
//         });

//         // return new Response(readableStream, {
//         //   headers: { "Content-Type": "text/plain; charset=utf-8" },
//         // });
//         return new Response(readableStream, {
//             headers: {
//                 "Content-Type": "text/event-stream; charset=utf-8", // 也可以用 text/plain
//                 "Cache-Control": "no-cache",
//                 "Connection": "keep-alive",
//             },
//         });
//     } catch (error: any) {
//         return new Response(JSON.stringify({ error: error.message }), { status: 500 });
//     }
// }

// import { ChatOpenAI } from "@langchain/openai";
// import { createRetrievalChain } from "langchain/chains/retrieval";
// import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
// import { ChatPromptTemplate } from "@langchain/core/prompts";

// export async function POST(req: Request) {
//   const { input, sessionId } = await req.json();

//   const llm = new ChatOpenAI({ modelName: "gpt-4" });
  
//   // 1. 初始化 Milvus 检索器
//   const vectorStore = await Milvus.fromExistingCollection(new OpenAIEmbeddings(), {
//     collectionName: "my_documents",
//     clientConfig: { address: process.env.MILVUS_ADDRESS! },
//   });
//   const retriever = vectorStore.asRetriever();

//   // 2. 定义 Prompt 模板
//   const prompt = ChatPromptTemplate.fromTemplate(`
//     Answer the following question based only on the provided context:
//     <context>
//     {context}
//     </context>
//     Question: {input}
//   `);

//   // 3. 构建链
//   const combineDocsChain = await createStuffDocumentsChain({ llm, prompt });
//   const retrievalChain = await createRetrievalChain({
//     retriever,
//     combineDocsChain,
//   });

//   const response = await retrievalChain.invoke({ input });

//   // 4. (可选) 将对话持久化到 MongoDB
//   // await mongoClient.db("chat").collection("history").insertOne({ sessionId, input, output: response.answer });

//   return Response.json({ answer: response.answer });
// }

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