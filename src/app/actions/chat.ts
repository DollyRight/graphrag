"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { indexDocument, graphRagQuery } from "@/lib/graph-rag";
import pdf from "pdf-parse";
import {connectDB} from "@/lib/client";
import Document from "@/models/Documents";
const FIXED_USER_ID = "user_123";

// 获取侧边栏列表
export async function getChatList() {
    return await prisma.chat.findMany({
        where: { userId: FIXED_USER_ID },
        orderBy: { createdAt: 'desc' },
    });
}

// 获取某个对话的历史消息
export async function getChatMessages(chatId: string) {
    return await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
    });
}

// 保存消息到数据库
export async function saveMessageAction({
    chatId,
    role,
    content
}: {
    chatId?: string,
    role: 'user' | 'assistant',
    content: string
}) {
    if (!chatId) {
        // 创建新会话，标题取用户提问的前15个字
        const newChat = await prisma.chat.create({
            data: {
                userId: FIXED_USER_ID,
                title: content.slice(0, 15),
                messages: {
                    create: { role, content }
                }
            }
        });
        revalidatePath("/chat");

        return newChat.id;
    } else {
        // 存入已有会话
        await prisma.message.create({
            data: { chatId, role, content }
        });
        revalidatePath("/chat");
        return chatId;
    }
}

/**
 * 删除指定的会话及其所有消息
 * @param chatId 会话ID
 */
export async function deleteChatAction(chatId: string) {
    try {
        // 验证该会话是否属于当前用户（安全校验）
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
        });

        if (!chat || chat.userId !== FIXED_USER_ID) {
            throw new Error("无权删除此会话或会话不存在");
        }

        // 执行删除逻辑
        // 注意：如果在 Prisma Schema 中配置了 onDelete: Cascade，
        // 那么删除 chat 会自动删除关联的所有 messages。
        await prisma.chat.delete({
            where: { id: chatId },
        });

        // 刷新缓存，确保侧边栏列表更新
        revalidatePath("/chat");
        return { success: true };
    } catch (error) {
        console.error("删除会话失败:", error);
        return { success: false, error: "删除失败，请稍后重试" };
    }
}

/**
 * 重命名会话标题
 */
export async function updateChatTitleAction(chatId: string, newTitle: string) {
    try {
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
        });

        if (!chat || chat.userId !== FIXED_USER_ID) {
            throw new Error("无权操作或会话不存在");
        }

        await prisma.chat.update({
            where: { id: chatId },
            data: { title: newTitle }
        });

        revalidatePath("/chat");
        return { success: true };
    } catch (error) {
        console.error("重命名失败:", error);
        return { success: false, error: "重命名失败" };
    }
}

export async function uploadAndIndex(formData: FormData) {
    const file = formData.get("file") as File;
    const kbId = formData.get("kbId") as string;

    // if (!file) return { error: "No file uploaded" };
    if (!file || !kbId) return { error: "Missing file or Knowledge Base ID" };
    try {
        await connectDB();

        // 1. 在 MongoDB 预创建文档记录
        const docRecord = await Document.create({
            kbId,
            fileName: file.name,
            status: "indexing",
        });

        const buffer = Buffer.from(await file.arrayBuffer());
        let text = "";

        if (file.type === "application/pdf") {
            const data = await pdf(buffer);
            text = data.text;
        } else {
            text = buffer.toString("utf-8");
        }

        if (!text.trim()) return { error: "Empty file" };

        // const result = await indexDocument(text, file.name);
        // 2. 调用索引函数，传入 kbId 和 fileId
        const result = await indexDocument(text, file.name, kbId, docRecord._id.toString());

        // 3. 更新 MongoDB 状态
        await Document.findByIdAndUpdate(docRecord._id, {
            status: "completed",
            neo4jStatus: true
        });
        return { success: true, message: `Indexed ${result.chunks} chunks.` };
    } catch (error: any) {
        console.error(error);
        return { error: error.message };
    }
}

