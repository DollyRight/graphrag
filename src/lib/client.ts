// lib/clients.ts
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import mongoose from "mongoose";


export const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "qwen-long-latest",
    temperature: 0,
    streaming: true, // 开启流式
    configuration: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    }
});

export const embeddings = new OpenAIEmbeddings({

    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-v4",
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
    batchSize: 10,


    dimensions: 1024,
})

export const milvusConfig = {
    url: process.env.MILVUS_URL || "localhost:19530",
    clientConfig: {
        timeout: 10000,
        address: process.env.MILVUS_URL || "localhost:19530"
    },
    indexParams: {
        metric_type: "L2",
        index_type: "IVF_FLAT",
        params: { nlist: 1024 },
    },
    // textFieldMaxLength: 1024
    textField: "text",    // 对应 Schema 中的 text
    vectorField: "vector" // 对应 Schema 中的 vector
};
// 初始化 Neo4j 图谱连接
export const initGraph = async () => {
    const graph = await Neo4jGraph.initialize({
        url: process.env.NEO4J_URI!,
        username: process.env.NEO4J_USERNAME!,
        password: process.env.NEO4J_PASSWORD!,
    });

    return graph;
};

// 导出底层的 MilvusClient 以供删除集合使用
export const milvusClient = new MilvusClient(milvusConfig.clientConfig);

// 初始化 Milvus 向量存储连接
export const getVectorStore = async (collectionName: string) => {
    const dynamicConfig = {
        ...milvusConfig,
        collectionName: collectionName
    };
    return await Milvus.fromExistingCollection(embeddings, dynamicConfig);
};



/**
 * 通用函数：在 Milvus 中创建标准的知识库集合
 * 解决了 loc 字段长度限制为 30 的问题
 */
export async function createMilvusCollection(kbId: string) {
    const collectionName = `kb_${kbId}`;
    try {
        const hasCol = await milvusClient.hasCollection({ collection_name: collectionName });
        if (!hasCol.value) {
            await milvusClient.createCollection({
                collection_name: collectionName,
                fields: [
                    { name: "pk", data_type: DataType.Int64, is_primary_key: true, autoID: true },
                    { name: "vector", data_type: DataType.FloatVector, dim: 1024 }, // 确保 dim 是 1024
                    { name: "text", data_type: DataType.VarChar, max_length: 8192 },
                    { name: "loc", data_type: DataType.VarChar, max_length: 1024 },
                    { name: "kbId", data_type: DataType.VarChar, max_length: 128 },
                    { name: "fileId", data_type: DataType.VarChar, max_length: 128 }
                ]
            });

            // 创建索引
            await milvusClient.createIndex({
                collection_name: collectionName,
                field_name: "vector",
                index_type: "IVF_FLAT",
                metric_type: "L2",
                params: { nlist: 1024 },
            });
            console.log(`✅ Milvus 集合 ${collectionName} 初始化成功`);
        }
    } catch (error) {
        console.error(`❌ Milvus 集合 ${collectionName} 创建失败:`, error);
        throw error; // 抛出异常让外层处理
    }
}

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
    throw new Error("请在 .env.local 文件中定义 MONGODB_URI");
}

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

