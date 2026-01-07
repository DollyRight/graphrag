"use client";

import { useState, useEffect, useRef } from "react";
import { uploadAndIndex, getChatList, getChatMessages, saveMessageAction } from "@/app/actions/chat";
import { Upload, Send, FileText, Loader2, MessageSquare, Plus, Copy, Edit3, Check, X, Share2, Database, FileUp } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Sidebar from "../components/Sidebar";
import { getKnowledgeBases } from "../actions/knowledge";
export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 从 URL 获取 id: http://localhost:3000/chat?id=xxxx
  const chatIdFromUrl = searchParams.get("id");
  // const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false); // 专门用于 AI 回答
  const [uploadLoading, setUploadLoading] = useState(false); // 专门用于文件上传
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  // 在 Home 组件内添加
  const scrollRef = useRef<HTMLDivElement>(null);
  // --- 新增：侧边栏状态逻辑 ---
  const [history, setHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [kbList, setKbList] = useState<any[]>([]);

  // 初始化获取知识库列表
  useEffect(() => {
    const fetchKBs = async () => {
      const list = await getKnowledgeBases();
      setKbList(list);
      if (list.length > 0) setSelectedKbId(list[0]._id); // 默认选第一个
    };
    fetchKBs();
  }, []);
  // --- 新增：复制功能 ---
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // 可选：添加一个简单的 Toast 提示
    alert("已复制到剪贴板");
  };

  // --- 新增：修改功能 ---
  const startEditing = (idx: number, content: string) => {
    setEditingIndex(idx);
    setEditContent(content);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditContent("");
  };

  const saveEdit = async (idx: number) => {
    if (!currentChatId) return;

    const newMessages = [...messages];
    newMessages[idx].content = editContent;
    setMessages(newMessages);
    setEditingIndex(null);

    // 同步数据库逻辑 (假设你有 updateMessageAction，或者重新覆盖该对话的所有消息)
    // 这里建议在 actions/chat.ts 中增加一个更新特定消息的函数
    // 简化处理：你可以重新 saveMessageAction
    console.log("消息已更新:", editContent);
  };




  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedKbId) return;

    setUploadLoading(true); 
    setUploadStatus("正在解析并构建图谱...");

    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    formData.append("kbId", selectedKbId);

    try {
      const res = await uploadAndIndex(formData);
      if (res.error) {
        setUploadStatus(`错误: ${res.error}`);
      } else {
        setUploadStatus(`成功! ${res.message}`);
        // 3秒后自动清除成功提示
        setTimeout(() => setUploadStatus(""), 3000);
      }
    } catch (err) {
      setUploadStatus("上传失败，请稍后再试");
    } finally {
      setUploadLoading(false); // 关闭上传 Loading
    }
  };

  // 1. 核心：监听 URL 参数变化
  useEffect(() => {
    if (chatIdFromUrl && !chatLoading) {
      loadChatData(chatIdFromUrl);
    } else {
      // 如果 URL 没有 id，说明是新对话
      handleNewChat();
    }

  }, [chatIdFromUrl]); // 只要 id 变了，就执行

  // 2. 加载指定对话数据
  const loadChatData = async (id: string) => {
    setChatLoading(true);
    setCurrentChatId(id);
    try {
      const msgs = await getChatMessages(id);
      setMessages(msgs);
    } catch (error) {
      console.error("加载失败", error);
    } finally {
      setChatLoading(false);
    }
  };



  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]); // 每当消息变化时触发


  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    // 如果当前 URL 有 id 但用户点了新建，则清空 URL
    if (searchParams.get("id")) {

      router.push("/chat");
    }
  };


  const handleSend = async () => {
    if (!input.trim() || chatLoading) return;
    const userText = input;
    const userMsg = { role: "user", content: userText };

    setInput("");
    setChatLoading(true);

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "..." }]);

    try {

      const activeChatId = await saveMessageAction({
        chatId: currentChatId || undefined,
        role: "user",
        content: userText,
      });


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


        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              role: "assistant",
              content: accumulated
            };
          }
          return [...updated]; // 确保返回新引用
        });
      }


      await saveMessageAction({
        chatId: activeChatId,
        role: "assistant",
        content: accumulated,
      });


      if (!currentChatId) {
        window.history.replaceState(null, '', `/chat?id=${activeChatId}`);

      }
      router.refresh();


    } catch (err) {
      console.error("Streaming error:", err);
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "抱歉，出错了。" }]);
    } finally {
      setChatLoading(false);
    }
  };




  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      {/* 右侧主聊天区域 */}
      <main className="flex-1 flex flex-col h-full bg-slate-50/30">
        {/* 消息展示区 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 mt-20 space-y-2">
                <div className="text-4xl">👋</div>
                <p>请上传文档并开始关于飞机的技术咨询...</p>
              </div>
            )}
            {messages.map((msg, idx) => (

              <div key={idx} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>

                {/* 消息主体 */}
                <div className={`relative p-4 rounded-2xl max-w-[90%] shadow-sm transition-all ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}>

                  {editingIndex === idx ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <textarea
                        className="w-full bg-transparent border-b border-white/50 focus:outline-none resize-none"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => saveEdit(idx)} className="p-1 hover:bg-white/20 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <>

                      <article className={`prose prose-sm max-w-none break-words ${msg.role === "user" ? "prose-invert" : ""}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </article>


                      {/* 操作按钮栏：仅在鼠标悬浮消息时显示 */}
                      <div className={`absolute -bottom-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "right-0 flex-row-reverse" : "left-0"}`}>
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="复制内容"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {msg.role === "user" && (
                          <button
                            onClick={() => startEditing(idx, msg.content)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="修改消息"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部输入框区域 - 集成了上传功能 */}
        <div className="p-4 bg-white border-t">
          <div className="max-w-4xl mx-auto">
            <div className="relative w-full max-w-4xl mx-auto px-4 pb-6">


              <div className="relative flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">

                {/* 顶部工具栏：知识库选择与文件上传 */}
                <div className="flex items-center gap-2 p-2 border-b border-slate-50">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={selectedKbId}
                      onChange={(e) => setSelectedKbId(e.target.value)}
                      className="text-xs font-bold bg-transparent text-slate-600 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      {kbList.length > 0 ? (
                        kbList.map(kb => (
                          <option key={kb._id} value={kb._id}>{kb.name}</option>
                        ))
                      ) : (
                        <option value="">请先创建知识库</option>
                      )}
                    </select>
                  </div>


                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  <label className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                      ${uploadLoading ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 shadow-sm'}
                    `}>
                    {uploadLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    ) : (
                      <FileUp className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadLoading ? "处理中" : "添加文档"}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleUpload}
                      accept=".pdf,.txt,.md"
                      disabled={uploadLoading || !selectedKbId}
                    />
                  </label>
                  {/* 上传状态提示语 - 仅在有状态时显示 */}
                  {uploadStatus && (
                    <div className=" px-2 flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse">
                      {uploadLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {uploadStatus}
                    </div>
                  )}
                </div>

                {/* 输入区域 */}
                <div className="relative flex items-center">
                  <textarea
                    rows={1}
                    className="w-full bg-transparent pl-4 pr-14 py-4 resize-none outline-none text-slate-700 placeholder:text-slate-400 min-h-[56px] max-h-32 text-sm lg:text-base
                      /* --- 滚动条优化开始 --- */
                      /* 1. 兼容 Firefox */
                      scrollbar-thin 
                      scrollbar-thumb-slate-200 
                      hover:scrollbar-thumb-slate-300
                      
                      /* 2. 兼容 Chrome/Safari (高度自定义) */
                      [&::-webkit-scrollbar]:w-1.5           /* 极细宽度 */
                      [&::-webkit-scrollbar-track]:bg-transparent 
                      [&::-webkit-scrollbar-thumb]:bg-slate-200 
                      [&::-webkit-scrollbar-thumb]:rounded-full
                      hover:[&::-webkit-scrollbar-thumb]:bg-slate-300
                      /* --- 滚动条优化结束 --- */"
                    placeholder={chatLoading ? "AI 正在思考中..." : "在此输入关于飞机的专业问题..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={chatLoading}
                  />

                  {/* 发送按钮：采用圆形悬浮设计 */}
                  <button
                    onClick={handleSend}
                    disabled={chatLoading || !input.trim()}
                    className={`
                      absolute right-3 p-2.5 rounded-xl transition-all duration-300
                      ${input.trim() && !chatLoading
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                    `}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}