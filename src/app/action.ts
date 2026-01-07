"use server";

import { indexDocument, graphRagQuery } from "@/lib/graph-rag";
import pdf from "pdf-parse";

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