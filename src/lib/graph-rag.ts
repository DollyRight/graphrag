// lib/graph-rag.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { initGraph, getVectorStore, llm, embeddings, milvusConfig } from "@/lib/client";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// --- A. 索引流程 (Indexing) ---

export async function indexDocument(text: string, source: string) {

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


export async function graphRagQuery(question: string) {

  const graph = await initGraph();
  const vectorStore = await getVectorStore();

  // 1. 向量检索 (非结构化搜索)
  const resultsWithScore = await vectorStore.similaritySearchWithScore(question, 3);
  // console.log("resultsWithScore", resultsWithScore.length)
  // console.log(resultsWithScore[0])
  // 过滤掉分值太低（即距离太远）的结果
  // 注意：阈值需要根据你的模型（OpenAI/阿里）反复调试，假设 0.4 是一个分水岭
  const vectorContext = resultsWithScore
    .filter(([doc, score]) => score < 0.7) // 仅保留足够相关的
    .map(([doc, score]) => doc.pageContent)
    .join("\n\n");

  // console.log("vectorContext", vectorContext.length)

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
  // const template = `
  //   你是一个飞机制造的AI助手。请结合以下两种上下文信息回答用户的问题。
  //   如果提供的上下文与用户问题无关，请直接忽略上下文，按照日常对话回答。
  //   ### 1. 详细文本资料 (来自向量数据库)
  //   {vector_context}

  //   ### 2. 结构化逻辑关系 (来自知识图谱)
  //   {graph_context}

  //   ---
  //   用户问题: {question}
  //   请根据上述信息，给出条理清晰、准确的回答。如果图谱关系揭示了文档中分散的逻辑（如零件间的包含关系、工艺的先后顺序），请重点说明。
  // `;
  const template = `
    你是一个深耕飞机制造领域的专家级 AI 助手。你的任务是基于提供的技术资料（非结构化文本）和知识图谱（结构化逻辑）来回答用户问题。

    ### 核心指令
    1. **相关性判定（关键）**：
       - 仔细比对 {question} 与上下文内容。
       - 如果 {vector_context} 和 {graph_context} 的内容与问题完全不相关（例如用户在闲聊或询问通用编程问题），请**完全忽略**上下文，仅以专业 AI 的身份进行日常对话。
       - **不要**强行将“飞机制造”的内容套用到不相关的问题中。

    2. **多源信息融合**：
       - **文本资料**用于提供细节描述、工艺参数和背景说明。
       - **知识图谱**用于揭示逻辑骨架（如：[零件A] -> 属于 -> [组件B]；[工序1] -> 先于 -> [工序2]）。
       - 如果图谱中有逻辑关系，请务必在回答中明确指出，例如：“从结构逻辑上看，XX 属于 XX 的关键子组件”。

    3. **输出格式规范**：
       - **条理性**：使用 Markdown 标题、列表或表格（针对对比/参数类信息）。
       - **溯源**：在引用资料内容时，请根据 metadata 标注来源（如：[来源: {vector_context} 中的文件名]）。
       - **严谨性**：如果资料中存在矛盾，请如实说明。

    4. **严格处理逻辑**：
       - **真实性优先**：请评估【详细文本资料】中的内容是否真的能回答【用户问题】。
       - **拒绝幻觉**：如果【详细文本资料】中的分值提示较低或内容完全风马牛不相及（例如资料在说“零件”，问题在说“天气”），请忽略该资料。
       - **图谱辅助**：如果文本模糊但【结构化逻辑关系】中存在实体关联，请以图谱逻辑为准进行推理。   
    ---
    ### 待分析上下文
    #### 1. 详细技术文档片段 (Vector Store)
    {vector_context}

    #### 2. 知识图谱结构逻辑 (Knowledge Graph)
    {graph_context}

    ---
    ### 用户交互
    用户问题: {question}

    请给出专业、准确且易于理解的回答：
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
  console.log("graphContext", graphContext)
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return await chain.stream({
    vector_context: vectorContext, // 修正为 vector_context   TODO: vector_context把需要的东西给filter了
    graph_context: graphContext,   // 修正为 graph_context
    question: question
  });
}