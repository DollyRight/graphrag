"use server";

import {connectDB} from "@/lib/client";
import KnowledgeBase from "@/models/KnowledgeBase";
import Document from "@/models/Documents";
import { revalidatePath } from "next/cache";
import { DataType } from "@zilliz/milvus2-sdk-node";
import { initGraph, milvusClient, getVectorStore, createMilvusCollection } from "@/lib/client";

// /**
//  * 初始化默认知识库
//  * 如果数据库为空，则创建一个名为“默认知识库”的记录
//  */
// export async function initDefaultKB() {
//   await connectDB();
//   const count = await KnowledgeBase.countDocuments();
//   if (count === 0) {
//     await KnowledgeBase.create({
//       name: "默认知识库",
//       description: "系统自动创建的初始知识库",
//       isDefault: true,
//     });
//     return { message: "初始化默认知识库成功" };
//   }
//   return { message: "知识库已存在" };
// }

export async function initDefaultKB() {
  await connectDB();
  try {
    const count = await KnowledgeBase.countDocuments();
    if (count === 0) {
      // 1. 创建 MongoDB 记录
      const defaultKB = await KnowledgeBase.create({
        name: "默认知识库",
        description: "系统自动创建的初始知识库",
        isDefault: true,
      });

      // 2. 创建对应的 Milvus 集合
      await createMilvusCollection(defaultKB._id.toString());

      return { success: true, message: "初始化默认知识库及向量空间成功" };
    }
    return { success: true, message: "知识库已存在" };
  } catch (error) {
    console.error("初始化默认知识库全流程失败:", error);
    return { success: false, error: "初始化失败" };
  }
}

export async function getKnowledgeBases() {
  try {
    await connectDB();

    // 使用聚合查询统计每个 KB 下的文档数量
    const kbs = await KnowledgeBase.aggregate([
      {
        $lookup: {
          from: "documents",         // 对应 MongoDB 中的集合名（通常是模型名的小写复数）
          localField: "_id",
          foreignField: "kbId",
          as: "documents"
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          isDefault: 1,
          createdAt: 1,
          fileCount: { $size: "$documents" } // 计算数组长度即为文件数
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    return JSON.parse(JSON.stringify(kbs));
  } catch (error) {
    console.error("获取知识库失败:", error);
    return [];
  }
}

// /**
//  * 创建新的知识库
//  */
// export async function createKnowledgeBase(data: { name: string; description?: string }) {
//   try {
//     await connectDB();
//     const newKB = await KnowledgeBase.create(data);
//     return { success: true, data: JSON.parse(JSON.stringify(newKB)) };
//   } catch (error) {
//     return { success: false, error: "创建失败" };
//   }
// }
/**
 * 创建新的知识库
 */
export async function createKnowledgeBase(data: { name: string; description?: string }) {
  try {
    await connectDB();

    // 1. 创建 MongoDB 记录
    const newKB = await KnowledgeBase.create(data);

    // 2. 创建对应的 Milvus 集合
    await createMilvusCollection(newKB._id.toString());

    revalidatePath("/knowledge-base");
    return { success: true, data: JSON.parse(JSON.stringify(newKB)) };
  } catch (error) {
    console.error("创建知识库失败:", error);
    return { success: false, error: "创建失败" };
  }
}
/**
 * 获取某个知识库下的所有文件记录
 */
export async function getDocumentsByKB(kbId: string) {
  try {
    await connectDB();
    const docs = await Document.find({ kbId }).sort({ createdAt: -1 });
    return JSON.parse(JSON.stringify(docs));
  } catch (error) {
    return [];
  }
}


// /**
//  * 删除知识库
//  * 逻辑：默认知识库禁止删除
//  */
// export async function deleteKnowledgeBase(kbId: string) {
//   try {
//     await connectDB();
//     const kb = await KnowledgeBase.findById(kbId);

//     if (!kb) return { success: false, error: "知识库不存在" };
//     if (kb.isDefault) return { success: false, error: "默认知识库禁止删除" };

//     // 注意：实际生产中，删除知识库可能还需要删除关联的 Document 和 Neo4j 数据
//     await KnowledgeBase.findByIdAndDelete(kbId);

//     revalidatePath("/knowledge-base");
//     return { success: true };
//   } catch (error) {
//     return { success: false, error: "删除失败" };
//   }
// }


export async function deleteKnowledgeBase(kbId: string) {
  try {
    await connectDB();

    // 1. 获取知识库信息
    const kb = await KnowledgeBase.findById(kbId);
    if (!kb) return { success: false, error: "知识库不存在" };
    if (kb.isDefault) return { success: false, error: "默认知识库禁止删除" };

    const collectionName = `kb_${kbId}`; // 确保与 indexDocument 中的命名规则一致

    // 2. 清理 Neo4j 数据 (删除所有 kbId 匹配的节点及其关系)
    try {
      const graph = await initGraph();
      // 使用 DETACH DELETE 确保关系也一并删除
      await graph.query(
        `MATCH (n {kbId: $kbId}) DETACH DELETE n`,
        { kbId: kbId.toString() }
      );
      console.log(`✅ Neo4j 数据清理成功: ${kbId}`);
    } catch (neo4jError) {
      console.error("❌ Neo4j 数据清理失败:", neo4jError);
      // 图谱失败可以记录，但不一定阻断流程
    }

    // 3. 清理 Milvus 数据 (删除整个 Collection)
    try {
      const hasCollection = await milvusClient.hasCollection({ collection_name: collectionName });
      if (hasCollection.value) {
        await milvusClient.dropCollection({ collection_name: collectionName });
        console.log(`✅ Milvus 集合清理成功: ${collectionName}`);
      }
    } catch (milvusError) {
      console.error("❌ Milvus 集合清理失败:", milvusError);
    }

    // 4. 清理 MongoDB 数据
    // 先删除关联的文件记录
    await Document.deleteMany({ kbId: kbId });
    // 再删除知识库记录
    await KnowledgeBase.findByIdAndDelete(kbId);

    console.log(`✅ MongoDB 记录清理成功: ${kbId}`);

    // 5. 刷新页面缓存
    revalidatePath("/knowledge-base");
    return { success: true };

  } catch (error) {
    console.error("删除知识库全流程失败:", error);
    return { success: false, error: "删除失败，系统遇到内部错误" };
  }
}

/**
 * 修改知识库信息
 */
export async function updateKnowledgeBase(kbId: string, data: { name: string; description?: string }) {
  try {
    await connectDB();
    const kb = await KnowledgeBase.findById(kbId);
    if (!kb) return { success: false, error: "知识库不存在" };

    await KnowledgeBase.findByIdAndUpdate(kbId, data);

    revalidatePath("/knowledge-base");
    return { success: true };
  } catch (error) {
    return { success: false, error: "更新失败" };
  }
}