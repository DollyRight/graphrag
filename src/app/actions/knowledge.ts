// "use client"; // 注意：如果是在 server component 调用，去掉这行，这里假设作为 Action 使用
"use server";

import connectDB from "@/lib/client";
import KnowledgeBase from "@/models/KnowledgeBase";
import Document from "@/models/Documents";
import { revalidatePath } from "next/cache";
/**
 * 初始化默认知识库
 * 如果数据库为空，则创建一个名为“默认知识库”的记录
 */
export async function initDefaultKB() {
  await connectDB();
  const count = await KnowledgeBase.countDocuments();
  if (count === 0) {
    await KnowledgeBase.create({
      name: "默认知识库",
      description: "系统自动创建的初始知识库",
      isDefault: true,
    });
    return { message: "初始化默认知识库成功" };
  }
  return { message: "知识库已存在" };
}

/**
 * 获取所有知识库列表
 */
export async function getKnowledgeBases() {
  try {
    await connectDB();
    const kbs = await KnowledgeBase.find({}).sort({ createdAt: -1 });
    return JSON.parse(JSON.stringify(kbs)); // 序列化以传递给 Client Component
  } catch (error) {
    console.error("获取知识库失败:", error);
    return [];
  }
}

/**
 * 创建新的知识库
 */
export async function createKnowledgeBase(data: { name: string; description?: string }) {
  try {
    await connectDB();
    const newKB = await KnowledgeBase.create(data);
    return { success: true, data: JSON.parse(JSON.stringify(newKB)) };
  } catch (error) {
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


/**
 * 删除知识库
 * 逻辑：默认知识库禁止删除
 */
export async function deleteKnowledgeBase(kbId: string) {
  try {
    await connectDB();
    const kb = await KnowledgeBase.findById(kbId);
    
    if (!kb) return { success: false, error: "知识库不存在" };
    if (kb.isDefault) return { success: false, error: "默认知识库禁止删除" };

    // 注意：实际生产中，删除知识库可能还需要删除关联的 Document 和 Neo4j 数据
    await KnowledgeBase.findByIdAndDelete(kbId);
    
    revalidatePath("/knowledge-base");
    return { success: true };
  } catch (error) {
    return { success: false, error: "删除失败" };
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