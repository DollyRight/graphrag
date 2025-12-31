import { NextRequest, NextResponse } from "next/server";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatOpenAI } from "@langchain/openai";
// import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        const model = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "qwen-long-latest",
            temperature: 0.7,
            streaming: true, // 开启流式
            configuration: {
                baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            }
        });

        const langChainMessages: BaseMessage[] = messages.map((m: any) => {
            const content = m.content || "";
            if (m.role === "user") return new HumanMessage(content);
            if (m.role === "assistant") return new AIMessage(content);
            if (m.role === "system") return new SystemMessage(content);
            return new HumanMessage(content);
        });

        // 使用流式输出
        const stream = await model.stream(langChainMessages);

        // 将 LangChain 的流转换为 TextEncoder 流返回给前端
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    controller.enqueue(encoder.encode(chunk.content as string));
                }
                controller.close();
            },
        });

        // return new Response(readableStream, {
        //   headers: { "Content-Type": "text/plain; charset=utf-8" },
        // });
        return new Response(readableStream, {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8", // 也可以用 text/plain
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// export async function POST(req: NextRequest) {
//   try {
//     const { messages } = await req.json();
//     const lastMessage = messages[messages.length - 1].content;

//     // 1. 初始化图数据库连接
//     const graph = await Neo4jGraph.initialize({
//       url: process.env.NEO4J_URI!,
//       username: process.env.NEO4J_USERNAME!,
//       password: process.env.NEO4J_PASSWORD!,
//     });

//     // 2. 初始化模型
//     const model = new ChatOpenAI({
//       modelName: "qwen-long-latest",
//       temperature: 0
//     });

//     // 3. 创建 Graph Cypher 链 (自动将自然语言转为 Cypher 语言查询图)
//     const chain = GraphCypherQAChain.fromLLM({
//       llm: model,
//       graph: graph,
//     });

//     // 4. 执行查询
//     const result = await chain.run(lastMessage);

//     return NextResponse.json({ content: result });
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json({ error: "GraphRAG 查询失败" }, { status: 500 });
//   }
// }