// models/Document.ts
import mongoose, { Schema, model, models } from "mongoose";

const DocumentSchema = new Schema({
  kbId: { type: Schema.Types.ObjectId, ref: "KnowledgeBase", required: true },
  fileName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["uploading", "indexing", "completed", "failed"], 
    default: "uploading" 
  },
  neo4jStatus: { type: Boolean, default: false },
}, { timestamps: true });

const Document = models.Document || model("Document", DocumentSchema);

export default Document;