"use server";

import { indexDocument, graphRagQuery } from "@/lib/graph-rag";
import pdf from "pdf-parse";
import {connectDB} from "@/lib/client";
import Document from "@/models/Documents";
export async function uploadAndIndex(formData: FormData) {
  const file = formData.get("file") as File;
  const kbId = formData.get("kbId") as string;
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
    const result = await indexDocument(text, file.name, kbId, docRecord._id.toString());
    return { success: true, message: `Indexed ${result.chunks} chunks.` };
  } catch (error: any) {
    console.error(error);
    return { error: error.message };
  }
}

