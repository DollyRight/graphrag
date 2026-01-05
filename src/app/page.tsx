"use client";

import { useState } from "react";
import { uploadAndIndex, askQuestion } from "@/app/actions";
import { Upload, Send, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; 
export default function Home() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setUploadStatus("正在解析并构建图谱 (可能需要几分钟)...");

    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    const res = await uploadAndIndex(formData);
    setLoading(false);

    if (res.error) {
      setUploadStatus(`错误: ${res.error}`);
    } else {
      setUploadStatus(`成功! ${res.message}`);
    }
  };

  // const handleSend = async () => {
  //   if (!input.trim()) return;
  //   const q = input;
  //   setInput("");
  //   setMessages((prev) => [...prev, { role: "user", content: q }]);

  //   setLoading(true);
  //   const res = await askQuestion(q);
  //   setLoading(false);

  //   if (res.answer) {
  //     setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
  //   } else {
  //     setMessages((prev) => [...prev, { role: "assistant", content: "出错了，请稍后再试。" }]);
  //   }
  // };
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // 添加一个空的占位消息给 AI
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!response.body) throw new Error("No body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulated += chunk;

        // 实时更新 UI
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = accumulated;
          return updated;
        });
      }
    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">GraphRAG 问答系统</h1>
        <p className="text-slate-500">基于 Next.js 16, LangChain, Milvus & Neo4j</p>
      </header>

      {/* Upload Section */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" /> 知识库构建
        </h2>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition">
            <Upload className="w-4 h-4" />
            上传 PDF/TXT
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt,.md" disabled={loading} />
          </label>
          {loading && <Loader2 className="animate-spin text-blue-600" />}
          <span className="text-sm text-slate-600">{uploadStatus}</span>
        </div>
      </div>

      {/* Chat Section */}
      <div className="border rounded-lg min-h-[500px] flex flex-col">
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[600px]">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 mt-20">
              请上传文档并开始提问...
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg max-w-[80%] ${msg.role === "user"
                  ? "bg-blue-100 ml-auto text-blue-900"
                  : "bg-slate-100 text-slate-800"
                }`}
            >
              {/* <ReactMarkdown>{msg.content}</ReactMarkdown> */}
              <article className="prose prose-sm max-w-none break-words overflow-hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </article>
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex gap-2">
          <input
            className="flex-1 border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入你的问题..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}