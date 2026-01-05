import { Milvus } from "@langchain/community/vectorstores/milvus";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  // 1. 加载文档
  const loader = new PDFLoader(file);
  const docs = await loader.load();

  // 2. 文本切分 (Chunking)
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splits = await splitter.splitDocuments(docs);

  // 3. 存储到 Milvus
  const vectorStore = await Milvus.fromDocuments(
    splits,
    new OpenAIEmbeddings(),
    {
      collectionName: "my_documents",
      clientConfig: { address: process.env.MILVUS_ADDRESS! },
    }
  );

  return Response.json({ success: true });
}

