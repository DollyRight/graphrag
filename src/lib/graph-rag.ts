// lib/graph-rag.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { initGraph, getVectorStore, llm, embeddings, milvusConfig } from "@/lib/client";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { connectDB, milvusClient } from "@/lib/client";
import DocumentModel from "@/models/Documents"; // 确保导入名称不冲突
import { DataType } from "@zilliz/milvus2-sdk-node";
// --- A. 索引流程 (Indexing) ---

export async function indexDocument(text: string, source: string, kbId: string, fileId: string) {
  await connectDB();
  try {
    // --- 更新 MongoDB 状态为正在索引 ---
    await DocumentModel.findByIdAndUpdate(fileId, { status: "indexing" });
    // 文本切分
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await splitter.createDocuments([text], []);



    // const dynamicConfig = {
    //   ...milvusConfig,
    //   collectionName: `kb_${kbId.toString()}`
    // };

    // await Milvus.fromDocuments(docs, embeddings, dynamicConfig);

    // 2. 核心：构造符合 Schema 的 cleanedDocs
    // const cleanedDocs = docs.map(doc => {
    //   return new Document({
    //     pageContent: doc.pageContent,
    //     metadata: {
    //       loc: JSON.stringify(doc.metadata?.loc || ""),
    //       kbId: kbId.toString(),
    //       fileId: fileId.toString(),
    //     }
    //   });
    // });



    // // 3. 明确指定 textField 和 vectorField
    // const dynamicConfig = {
    //   ...milvusConfig,
    //   collectionName: `kb_${kbId.toString()}`,

    // };


    // await Milvus.fromDocuments(cleanedDocs, embeddings, dynamicConfig);



    // const collectionName = `kb_${kbId}`;

    // // 1. 获取向量。注意：embeddings.embedDocuments(texts) 返回的是 number[][]
    // const texts = docs.map(d => d.pageContent);
    // const allVectors: number[][] = await embeddings.embedDocuments(texts);

    // // 2. 构造插入数据。确保每个字段的值类型与 Milvus DataType 严格对应
    // const insertData = docs.map((doc, index) => {
    //   return {
    //     // 关键点：这里的 vector 必须是一个简单的 number[]
    //     // 不要外层嵌套，也不要包装成对象
    //     vector: allVectors[index],
    //     text: doc.pageContent,
    //     loc: JSON.stringify(doc.metadata?.loc || ""),
    //     kbId: kbId.toString(),
    //     fileId: fileId.toString()
    //   };
    // });

    // // 3. 原生 SDK 插入
    // const insertRes = await milvusClient.insert({
    //   collection_name: collectionName,
    //   data: insertData,
    // });

    // if (insertRes.status.error_code !== "Success" && insertRes.status.reason !== "") {
    //   if (insertRes.status.reason.includes("num_rows")) {
    //     console.log("尝试备选插入格式...");
    //     await milvusClient.insert({
    //       collection_name: collectionName,
    //       fields_data: insertData
    //     });
    //   } else {
    //     throw new Error(insertRes.status.reason);
    //   }
    // }

    // console.log("✅ Milvus 数据存入成功");

    const info = await milvusClient.describeCollection({ collection_name: `kb_${kbId}` });
    console.log("数据库中真实的字段名:", info.schema.fields.map(f => f.name));
    const collectionName = `kb_${kbId}`;
    const texts = docs.map(d => d.pageContent);
    const allVectors = await embeddings.embedDocuments(texts);

    // 构造最纯粹的行数据数组
    const insertData = docs.map((doc, index) => {
      // 显式构造对象，严格对应你 describe 出来的字段名
      return {
        "vector": allVectors[index], // number[]
        "text": String(doc.pageContent),
        "loc": typeof doc.metadata?.loc === 'string' ? doc.metadata.loc : JSON.stringify(doc.metadata?.loc || ""),
        "kbId": String(kbId),
        "fileId": String(fileId)
      };
    });

    console.log("即将尝试 Row 模式插入，第一行键名:", Object.keys(insertData[0]));

    const insertRes = await milvusClient.insert({
      collection_name: collectionName,
      data: insertData, // 使用 data 而不是 fields_data
    });

    if (insertRes.status.error_code !== "Success") {
      throw new Error(`Milvus Insert Error: ${insertRes.status.reason}`);
    }
    console.log(`✅ 列模式插入成功: ${docs.length} 条数据`);
    await DocumentModel.findByIdAndUpdate(fileId, { status: "indexing" });


    const graph = await initGraph();
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
    let hasNeo4jData = false;

    for (const doc of docs) {
      try {
        const res = await chain.invoke({ input: doc.pageContent });
        const content = typeof res.content === 'string' ? res.content.replace(/```json|```/g, "").trim() : "";
        const parsed = JSON.parse(content);

        const graphDocument = {
          nodes: parsed.nodes.map((n: any) => ({
            id: String(n.id),
            type: n.type || "Entity",
            properties: { kbId, fileId } // 注入 ID 方便以后查询和删除
          })),
          relationships: parsed.relationships.map((r: any) => ({
            source: { id: String(r.source), type: "Entity" },
            target: { id: String(r.target), type: "Entity" },
            type: r.type,
            properties: { kbId, fileId } // 注入 ID
          })),
          source: doc
        };

        await graph.addGraphDocuments([graphDocument as any], {});
        hasNeo4jData = true;
        console.log("✅ 成功存入一个区块到 Neo4j");
      } catch (e) {
        console.error("❌ 提取区块失败:", e);
      }
    }

    // --- 5. 索引完成，更新 MongoDB 最终状态 ---
    await DocumentModel.findByIdAndUpdate(fileId, {
      status: "completed",
      neo4jStatus: hasNeo4jData // 如果存入了图谱数据，标记为 true
    });
    return { success: true, chunks: docs.length };
  } catch (error) {
    console.error("索引全流程失败:", error);
    // 失败处理：更新 MongoDB 为失败状态
    await DocumentModel.findByIdAndUpdate(fileId, { status: "failed" });
    return { success: false, error: "索引失败" };
  }
}



// --- B. 检索与问答流程 (Retrieval & Generation) ---
export async function graphRagQuery(question: string, collection_name: string) {

  const graph = await initGraph();
  const vectorStore = await getVectorStore(collection_name);

  // 1. 向量检索 (非结构化搜索)
  const resultsWithScore = await vectorStore.similaritySearchWithScore(question, 3);
  // 过滤掉分值太低（即距离太远）的结果
  // 注意：阈值需要根据你的模型（OpenAI/阿里）反复调试，假设 0.4 是一个分水岭
  const vectorContext = resultsWithScore
    .filter(([doc, score]) => score < 0.7) // 仅保留足够相关的
    .map(([doc, score]) => doc.pageContent)
    .join("\n\n");


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

  // 第二步：在 Neo4j 中执行 Cypher 查询~
  // 查找这些实体及其直接相连的关系（一阶邻居）
  let graphContext = "";
  try {
    // const cypherQuery = `
    //   MATCH (n)-[r]->(m)
    //   WHERE n.id IN $entities OR m.id IN $entities
    //   RETURN n.id AS source, type(r) AS rel, m.id AS target
    //   LIMIT 10
    // `;

    // const cypherQuery = `
    //   MATCH (n)-[r]->(m)
    //   WHERE (n.id IN $entities OR m.id IN $entities)
    //     AND n.kbId = $kbId  // 关键：只查询当前知识库的数据
    //   RETURN n.id AS source, type(r) AS rel, m.id AS target
    //   LIMIT 10
    // `;
    // const cypherQuery = `
    // MATCH (n)
    // WHERE n.kbId = $kbId AND n.id IN $entities
    // MATCH (n)-[r]-(m) // 这里的连接不带箭头，表示双向查询
    // WHERE m.kbId = $kbId
    // RETURN n.id AS source, type(r) AS rel, m.id AS target
    // LIMIT 20
    // `
    const cypherQuery = `
    MATCH (n)
    WHERE n.kbId = $kbId AND n.id IN $entities
    MATCH (n)-[r]-(m) 
    WHERE m.kbId = $kbId
    RETURN n.id AS source, type(r) AS rel, m.id AS target
    LIMIT 20
  `;
    const graphResults: any[] = await graph.query(cypherQuery, {
      entities,
      kbId: "你的知识库ID" // ！！！必须确保这个值存在且正确
    });
    // const graphResults: any[] = await graph.query(cypherQuery, { entities });

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

  console.log(graphContext)
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return await chain.stream({
    vector_context: vectorContext, // 修正为 vector_context   TODO: vector_context把需要的东西给filter了
    graph_context: graphContext,   // 修正为 graph_context
    question: question
  });
}