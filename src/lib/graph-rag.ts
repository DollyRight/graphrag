// lib/graph-rag.ts
// import { LLMGraphTransformer } from "@langchain/community/graph_transformers/llm";
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { initGraph, getVectorStore, llm, embeddings, testMilvusConnection, initMilvusCollection, milvusConfig } from "@/lib/client";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";




// --- A. 索引流程 (Indexing) ---

export async function indexDocument(text: string, source: string) {
  // const isReady = await initMilvusCollection();
  // if (!isReady) throw new Error("Milvus 准备就绪失败");
  // console.log(`开始处理文档: ${source}`);

  // 1. 文本切分
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.createDocuments([text], []);

  
  // 2. 存入 Milvus (Vector 索引)

  await Milvus.fromDocuments(docs, embeddings, milvusConfig);

  // 手动构建一个 Prompt，要求返回纯 JSON
  const prompt = ChatPromptTemplate.fromTemplate(`
    你是一个知识图谱专家。请从以下文本中提取实体和它们之间的关系。
    输出格式必须是严格的 JSON 格式，包含 "nodes" 和 "relationships" 两个列表。
    
    示例格式：
    {{
      "nodes": [{{ "id": "1", "type": "零件", "properties": {{ "名称": "蒙皮" }} }}],
      "relationships": [{{ "source": "1", "target": "2", "type": "属于" }}]
    }}

    文本内容：
    {input}
  `);

  const chain = prompt.pipe(llm);

  const graph = await initGraph();
  for (const doc of docs) {
    try {
      const res = await chain.invoke({ input: doc.pageContent });
      const content = typeof res.content === 'string' ? res.content.replace(/```json|```/g, "").trim() : "";
      const parsed = JSON.parse(content);

      // 关键：构建符合 LangChain 定义的 GraphDocument
      const graphDocument = {
        nodes: parsed.nodes.map((n: any) => ({
          id: String(n.id), // 强制转为字符串
          type: n.type || "Entity",
          properties: {} // 先保持为空，避免嵌套属性报错
        })),
        relationships: parsed.relationships.map((r: any) => ({
          source: { id: String(r.source), type: "Entity" },
          target: { id: String(r.target), type: "Entity" },
          type: r.type,
          properties: {}
        })),
        source: doc
      };

      await graph.addGraphDocuments([graphDocument as any], {});
      console.log("✅ 成功存入一个区块到 Neo4j");
    } catch (e) {
      console.error("❌ 提取区块失败:", e);
    }
  }


  return { success: true, chunks: docs.length };
}



// --- B. 检索与问答流程 (Retrieval & Generation) ---

// export async function graphRagQuery(question: string) {
//   const graph = await initGraph();
//   const vectorStore = await getVectorStore();

//   // 1. 向量检索 (非结构化搜索)
//   const vectorResults = await vectorStore.similaritySearch(question, 3);
//   const vectorContext = vectorResults.map((d) => d.pageContent).join("\n\n");

//   // 2. 图谱检索 (结构化搜索)
//   // 这里使用简化的全文检索：先提取问题中的实体，再在图中查找相关三元组
//   // 注意：生产环境通常需要为 Neo4j 配置 Fulltext Index

//   // 简单策略：让 LLM 生成 Cypher 查询 (Text2Cypher) 或者使用 LangChain 的检索链
//   // 为了演示稳定性，我们这里使用 QA Chain 对图谱进行特定查询
//   // 下面是一个简化的图谱上下文获取逻辑：

//   // 实际上，GraphRAG 通常会做 "Global Search" 或 "Local Search"
//   // 这里我们做一个简单的 "Graph Context Fetch": 查找与问题最相关的实体及其邻居

//   // (为简化代码，这里直接使用 Neo4j 的 query 方法查询 schema，实际需更复杂的检索)
//   // 假设我们直接把 Neo4j 作为上下文源之一：
//   //   const graphChain = await graph.asRetriever(); 
//   // 注意：asRetriever 默认可能基于向量索引，如果 Neo4j 版本支持 Vector Index

//   // 如果没有在 Neo4j 建向量索引，我们可以手动构造一个简单的 Cypher 查相关文本
//   // 这里的简化版：仅使用 Vector 结果 + 让 LLM 基于已知的图谱知识（如果开启了 Schema）

//   // *更高级的 GraphRAG 实现需要先提取问题里的 Entity，然后去 Neo4j 查 neighbors*
//   // *由于代码篇幅限制，这里我们采用混合 Prompt 策略*
//   // 第一步：从问题中提取潜在的实体节点 ID
//   // 我们使用简单的 Prompt 让 LLM 提取关键词，避免复杂的 JSON Schema 报错
//   const entityExtractionPrompt = ChatPromptTemplate.fromTemplate(`
//     从用户问题中提取 2-3 个核心实体关键词（如零件名称、工艺、装置）。
//     直接输出关键词，用逗号分隔，不要有其他文字。
//     问题：{question}
//   `);

//   const extractChain = entityExtractionPrompt.pipe(llm).pipe(new StringOutputParser());
//   const entityString = await extractChain.invoke({ question });
//   const entities = entityString.split(",").map(e => e.trim()).filter(e => e.length > 0);

//   console.log("提取到的图谱检索实体:", entities);

//   // 第二步：在 Neo4j 中执行 Cypher 查询
//   // 查找这些实体及其直接相连的关系（一阶邻居）
//   let graphContext = "";
//   try {
//     const cypherQuery = `
//       MATCH (n)-[r]->(m)
//       WHERE n.id IN $entities OR m.id IN $entities
//       RETURN n.id AS source, type(r) AS rel, m.id AS target
//       LIMIT 10
//     `;

//     const graphResults: any[] = await graph.query(cypherQuery, { entities });

//     if (graphResults.length > 0) {
//       graphContext = graphResults
//         .map(row => `- 【${row.source}】 --(${row.rel})--> 【${row.target}】`)
//         .join("\n");
//     } else {
//       graphContext = "未在知识图谱中找到直接关联的结构化关系。";
//     }
//   } catch (err) {
//     console.error("Cypher 查询失败:", err);
//     graphContext = "图谱查询出错。";
//   }
//   // const template = `
//   // 你是一个智能助手。请基于以下上下文回答问题。

//   // --- 向量数据库检索到的文本 ---
//   // {vector_context}


//   // --- 知识图谱背景 ---
//   // (系统已连接知识图谱，请综合考虑实体间的潜在关系)

//   // 用户问题: {question}

//   // 请综合以上信息，给出详细、有逻辑的回答。
//   // `;
//   const template = `
//     你是一个深谙技术文档的 AI 助手。请结合以下两种上下文信息回答用户的问题。

//     ### 1. 详细文本资料 (来自向量数据库)
//     {vector_context}

//     ### 2. 结构化逻辑关系 (来自知识图谱)
//     {graph_context}

//     ---
//     用户问题: {question}

//     请根据上述信息，给出条理清晰、准确的回答。如果图谱关系揭示了文档中分散的逻辑（如零件间的包含关系、工艺的先后顺序），请重点说明。
//   `;

//   const prompt = ChatPromptTemplate.fromTemplate(template);

//   const chain = RunnableSequence.from([
//     prompt,
//     llm,
//     new StringOutputParser(),
//   ]);

//   // const response = await chain.invoke({
//   //   vector_context: vectorContext,
//   //   question: question,
//   // });
//   const response = await chain.invoke({
//     vector_context: vectorContext,
//     graph_context: graphContext,
//     question: question,
//   });
//   return response;
// }

export async function graphRagQuery(question: string) {

  const graph = await initGraph();
  const vectorStore = await getVectorStore();

  // 1. 向量检索 (非结构化搜索)
  // const vectorResults = await vectorStore.similaritySearch(question, 3);
  // const vectorContext = vectorResults.map((d) => d.pageContent).join("\n\n");
  // console.log("vectorContext",vectorContext)
  const resultsWithScore = await vectorStore.similaritySearchWithScore(question, 3);
  console.log("resultsWithScore",resultsWithScore.length)
  // 过滤掉分值太低（即距离太远）的结果
  // 注意：阈值需要根据你的模型（OpenAI/阿里）反复调试，假设 0.4 是一个分水岭
  const vectorContext = resultsWithScore
    .filter(([doc, score]) => score > 0.3) // 仅保留足够相关的
    .map(([doc, score]) => doc.pageContent)
    .join("\n\n");

  console.log("vectorContext",vectorContext.length)  
  console.log("")
  // 2. 图谱检索 (结构化搜索)
  // 这里使用简化的全文检索：先提取问题中的实体，再在图中查找相关三元组
  // 注意：生产环境通常需要为 Neo4j 配置 Fulltext Index

  // 简单策略：让 LLM 生成 Cypher 查询 (Text2Cypher) 或者使用 LangChain 的检索链
  // 为了演示稳定性，我们这里使用 QA Chain 对图谱进行特定查询
  // 下面是一个简化的图谱上下文获取逻辑：

  // 实际上，GraphRAG 通常会做 "Global Search" 或 "Local Search"
  // 这里我们做一个简单的 "Graph Context Fetch": 查找与问题最相关的实体及其邻居

  // (为简化代码，这里直接使用 Neo4j 的 query 方法查询 schema，实际需更复杂的检索)
  // 假设我们直接把 Neo4j 作为上下文源之一：
  //   const graphChain = await graph.asRetriever(); 
  // 注意：asRetriever 默认可能基于向量索引，如果 Neo4j 版本支持 Vector Index

  // 如果没有在 Neo4j 建向量索引，我们可以手动构造一个简单的 Cypher 查相关文本
  // 这里的简化版：仅使用 Vector 结果 + 让 LLM 基于已知的图谱知识（如果开启了 Schema）

  // *更高级的 GraphRAG 实现需要先提取问题里的 Entity，然后去 Neo4j 查 neighbors*
  // *由于代码篇幅限制，这里我们采用混合 Prompt 策略*
  // 第一步：从问题中提取潜在的实体节点 ID
  // 我们使用简单的 Prompt 让 LLM 提取关键词，避免复杂的 JSON Schema 报错
  const entityExtractionPrompt = ChatPromptTemplate.fromTemplate(`
    从用户问题中提取 2-3 个核心实体关键词（如零件名称、工艺、装置）。
    直接输出关键词，用逗号分隔，不要有其他文字。
    问题：{question}
  `);

  const extractChain = entityExtractionPrompt.pipe(llm).pipe(new StringOutputParser());
  const entityString = await extractChain.invoke({ question });
  const entities = entityString.split(",").map(e => e.trim()).filter(e => e.length > 0);

  console.log("提取到的图谱检索实体:", entities);

  // 第二步：在 Neo4j 中执行 Cypher 查询
  // 查找这些实体及其直接相连的关系（一阶邻居）
  let graphContext = "";
  try {
    const cypherQuery = `
      MATCH (n)-[r]->(m)
      WHERE n.id IN $entities OR m.id IN $entities
      RETURN n.id AS source, type(r) AS rel, m.id AS target
      LIMIT 10
    `;

    const graphResults: any[] = await graph.query(cypherQuery, { entities });

    if (graphResults.length > 0) {
      graphContext = graphResults
        .map(row => `- 【${row.source}】 --(${row.rel})--> 【${row.target}】`)
        .join("\n");
    } else {
      graphContext = "未在知识图谱中找到直接关联的结构化关系。";
    }
  } catch (err) {
    console.error("Cypher 查询失败:", err);
    graphContext = "图谱查询出错。";
  }
  // const template = `
  // 你是一个智能助手。请基于以下上下文回答问题。

  // --- 向量数据库检索到的文本 ---
  // {vector_context}


  // --- 知识图谱背景 ---
  // (系统已连接知识图谱，请综合考虑实体间的潜在关系)

  // 用户问题: {question}

  // 请综合以上信息，给出详细、有逻辑的回答。
  // `;
  const template = `
    你是一个深谙技术文档的 AI 助手。请结合以下两种上下文信息回答用户的问题。

    如果提供的上下文与用户问题无关，请直接忽略上下文，按照日常对话回答。
    ### 1. 详细文本资料 (来自向量数据库)
    {vector_context}

    ### 2. 结构化逻辑关系 (来自知识图谱)
    {graph_context}

    ---
    用户问题: {question}

    请根据上述信息，给出条理清晰、准确的回答。如果图谱关系揭示了文档中分散的逻辑（如零件间的包含关系、工艺的先后顺序），请重点说明。
  `;

  const prompt = ChatPromptTemplate.fromTemplate(template);

  // const chain = RunnableSequence.from([
  //   prompt,
  //   llm,
  //   new StringOutputParser(),
  // ]);

  // const response = await chain.invoke({
  //   vector_context: vectorContext,
  //   question: question,
  // });
  // const response = await chain.invoke({
  //   vector_context: vectorContext,
  //   graph_context: graphContext,
  //   question: question,
  // });
  // return response;
  console.log("graphContext",graphContext)
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return await chain.stream({
    vector_context: resultsWithScore, // 修正为 vector_context   TODO: vector_context把需要的东西给filter了
    graph_context: graphContext,   // 修正为 graph_context
    question: question
  });
}