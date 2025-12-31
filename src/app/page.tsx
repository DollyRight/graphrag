"use client";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { User, Bot, Send } from "lucide-react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // 预设一个空的 AI 回答消息用于占位
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedContent = "";

      // 读取流
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        accumulatedContent += chunkValue;

        // 实时更新最后一条消息（即 AI 的回答）
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = accumulatedContent;
          return newMsgs;
        });
      }
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* 头部 */}
      <header className="p-4 bg-white border-b text-center font-bold shadow-sm">
        Qwen Graph Assistant
      </header>

      {/* 聊天内容区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex max-w-[80%] ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              } gap-3`}
            >
              {/* 头像 */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.role === "user" ? "bg-blue-500" : "bg-emerald-500"
              }`}>
                {m.role === "user" ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
              </div>

              {/* 气泡 */}
              <div className={`p-3 rounded-2xl shadow-sm ${
                m.role === "user" 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-gray-800 border border-gray-200 rounded-tl-none"
              }`}>
                <article className="prose prose-sm max-w-none break-words overflow-hidden">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                  {m.role === 'assistant' && m.content === '' && (
                    <span className="animate-pulse">▍</span>
                  )}
                </article>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 输入框区 */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <input
            className="flex-1 border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入您的问题..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`px-5 py-3 rounded-xl flex items-center gap-2 font-medium transition-all ${
              isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <Send size={18} />
            {isLoading ? "生成中..." : "发送"}
          </button>
        </form>
      </div>
    </main>
  );
}