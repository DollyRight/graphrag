"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { indexDocument, graphRagQuery } from "@/lib/graph-rag";
import pdf from "pdf-parse";


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
        revalidatePath("/"); // 刷新页面缓存，让侧边栏更新
        return newChat.id;
    } else {
        // 存入已有会话
        await prisma.message.create({
            data: { chatId, role, content }
        });
        return chatId;
    }
}



export async function uploadAndIndex(formData: FormData) {
    const file = formData.get("file") as File;
    if (!file) return { error: "No file uploaded" };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let text = "";

        if (file.type === "application/pdf") {
            const data = await pdf(buffer);
            text = data.text;
        } else {
            text = buffer.toString("utf-8");
        }

        if (!text.trim()) return { error: "Empty file" };

        const result = await indexDocument(text, file.name);
        return { success: true, message: `Indexed ${result.chunks} chunks.` };
    } catch (error: any) {
        console.error(error);
        return { error: error.message };
    }
}

export async function askQuestion(question: string) {
    try {
        const answer = await graphRagQuery(question);

        return { answer };
    } catch (error: any) {
        return { error: error.message };
    }
}