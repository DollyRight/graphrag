// models/KnowledgeBase.ts
import mongoose, { Schema, model, models } from "mongoose";

const KnowledgeBaseSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true }); // 自动生成 createdAt 和 updatedAt

// 防止 Next.js 热重载时重复编译模型
const KnowledgeBase = models.KnowledgeBase || model("KnowledgeBase", KnowledgeBaseSchema);

export default KnowledgeBase;