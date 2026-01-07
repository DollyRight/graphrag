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

// export const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY, });
export const embeddings = new OpenAIEmbeddings({
    // 1. 传入阿里百炼的 API Key
    openAIApiKey: process.env.OPENAI_API_KEY,

    // 2. 指定阿里百炼的模型名称
    modelName: "text-embedding-v4",

    // 3. 配置兼容层地址
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },

    // 4. 可选：针对百炼的并发限制进行微调
    batchSize: 10,
})

export const milvusConfig = {
    collectionName: "graph_rag_docs",
    url: process.env.MILVUS_URL || "localhost:19530", // 必须指定 URL
    clientConfig: {
        timeout: 10000, // 增加超时时间到 10s
        address: process.env.MILVUS_URL || "localhost:19530"
    },
    indexParams: {
        metric_type: "L2",       // 相似度度量，通常用 L2 或 IP (内积)
        index_type: "IVF_FLAT",  // 索引类型
        params: { nlist: 1024 },
    },
};
// 2. 初始化 Neo4j 图谱连接
export const initGraph = async () => {
    const graph = await Neo4jGraph.initialize({
        url: process.env.NEO4J_URI!,
        username: process.env.NEO4J_USERNAME!,
        password: process.env.NEO4J_PASSWORD!,
    });

    return graph;
};

// 3. 初始化 Milvus 向量存储连接
export const getVectorStore = async () => {
    return await Milvus.fromExistingCollection(embeddings, milvusConfig);
};

/**
 * 测试 Milvus 连接状态
 */
export const testMilvusConnection = async () => {
    const url = process.env.MILVUS_URL || "localhost:19530";

    // 创建一个临时的底层客户端进行检测
    const client = new MilvusClient({
        address: url,
        // 如果有 token 也要加上
        // token: process.env.MILVUS_TOKEN 
    });

    try {
        // 1. 检查服务健康状态
        const health = await client.checkHealth();

        // 2. 尝试列出集合（进一步确认权限和连接）
        const collections = await client.listCollections();

        if (health.isHealthy) {
            console.log("✅ Milvus 连接成功!");
            console.log(`📡 地址: ${url}`);
            console.log(`📚 当前集合数量: ${collections}`);
            return { success: true, details: health };
        } else {
            throw new Error("Milvus 返回不健康状态");
        }
    } catch (error: any) {
        console.error("❌ Milvus 连接失败:");
        console.error(`原因: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        // 检测完建议关闭临时连接
        await client.closeConnection();
    }
};

export const initMilvusCollection = async () => {
    const client = new MilvusClient({ address: process.env.MILVUS_URL || "localhost:19530" });
    const collectionName = "graph_rag_docs";

    try {
        // 1. 检查是否存在
        const exists = await client.hasCollection({ collection_name: collectionName });

        if (!exists.value) {
            console.log(`正在创建 Collection: ${collectionName}...`);
            // 2. 手动创建 Schema (LangChain 默认结构)
            await client.createCollection({
                collection_name: collectionName,
                fields: [
                    { name: "pk", data_type: DataType.Int64, is_primary_key: true, autoID: true },
                    { name: "vector", data_type: DataType.FloatVector, dim: 1536 }, // OpenAI 维度是 1536
                    { name: "text", data_type: DataType.VarChar, max_length: 65535 },
                    { name: "metadata", data_type: DataType.JSON },

                ],
            });

            // 3. 创建索引 (写入前必须创建索引，否则无法 Load)
            await client.createIndex({
                collection_name: collectionName,
                field_name: "vector",
                index_name: "vector_index",
                index_type: "IVF_FLAT",
                metric_type: "L2",
                params: { nlist: 1024 },
            });
        }

        // 4. 关键一步：加载到内存
        await client.loadCollectionSync({ collection_name: collectionName });
        console.log("✅ Milvus Collection 已就绪并加载至内存");

        return true;
    } catch (error) {
        console.error("❌ 初始化 Milvus 失败:", error);
        return false;
    } finally {
        await client.closeConnection();
    }
};


const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
    throw new Error("请在 .env.local 文件中定义 MONGODB_URI");
}

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export default connectDB;