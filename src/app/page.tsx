// "use client";

// import { useState, useEffect, useRef } from "react";
// import { uploadAndIndex, getChatList, getChatMessages, saveMessageAction } from "@/app/actions/chat";
// import { Upload, Send, FileText, Loader2, MessageSquare, Plus, Copy, Edit3, Check, X,Share2 } from "lucide-react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import 'katex/dist/katex.min.css';
// import remarkMath from 'remark-math';
// import rehypeKatex from 'rehype-katex';

// export default function Home() {
//   const [loading, setLoading] = useState(false);
//   const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
//   const [input, setInput] = useState("");
//   const [uploadStatus, setUploadStatus] = useState("");
//   // 在 Home 组件内添加
//   const scrollRef = useRef<HTMLDivElement>(null);
//   // --- 新增：侧边栏状态逻辑 ---
//   const [history, setHistory] = useState<any[]>([]);
//   const [currentChatId, setCurrentChatId] = useState<string | null>(null);

//   const [editingIndex, setEditingIndex] = useState<number | null>(null);
//   const [editContent, setEditContent] = useState("");

//   // --- 新增：复制功能 ---
//   const handleCopy = (text: string) => {
//     navigator.clipboard.writeText(text);
//     // 可选：添加一个简单的 Toast 提示
//     alert("已复制到剪贴板");
//   };

//   // --- 新增：修改功能 ---
//   const startEditing = (idx: number, content: string) => {
//     setEditingIndex(idx);
//     setEditContent(content);
//   };

//   const cancelEdit = () => {
//     setEditingIndex(null);
//     setEditContent("");
//   };

//   const saveEdit = async (idx: number) => {
//     if (!currentChatId) return;

//     const newMessages = [...messages];
//     newMessages[idx].content = editContent;
//     setMessages(newMessages);
//     setEditingIndex(null);

//     // 同步数据库逻辑 (假设你有 updateMessageAction，或者重新覆盖该对话的所有消息)
//     // 这里建议在 actions/chat.ts 中增加一个更新特定消息的函数
//     // 简化处理：你可以重新 saveMessageAction
//     console.log("消息已更新:", editContent);
//   };

//   const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (!e.target.files?.[0]) return;
//     setLoading(true);
//     setUploadStatus("正在解析并构建图谱 (可能需要几分钟)...");

//     const formData = new FormData();
//     formData.append("file", e.target.files[0]);

//     const res = await uploadAndIndex(formData);
//     setLoading(false);

//     if (res.error) {
//       setUploadStatus(`错误: ${res.error}`);
//     } else {
//       setUploadStatus(`成功! ${res.message}`);
//     }
//   };

//   // 初始化获取侧边栏
//   useEffect(() => {
//     refreshHistory();
//   }, []);

//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [messages]); // 每当消息变化时触发

//   const refreshHistory = async () => {
//     const list = await getChatList();
//     console.log("------------------------------",list)
//     setHistory(list);
//   };

//   const handleSelectChat = async (id: string) => {
//     if (loading) return;
//     setCurrentChatId(id);
//     const msgs = await getChatMessages(id);
//     setMessages(msgs);
//   };

//   const handleNewChat = () => {
//     setCurrentChatId(null);
//     setMessages([]);
//     setUploadStatus("");
//   };

//   const handleSend = async () => {
//     if (!input.trim() || loading) return;

//     const userText = input;
//     const userMsg = { role: "user", content: userText };

//     // 1. 发送前先保存用户消息到数据库，确保有 chatId
//     const activeChatId = await saveMessageAction({
//       chatId: currentChatId || undefined,
//       role: "user",
//       content: userText,
//     });

//     if (!currentChatId) {
//       setCurrentChatId(activeChatId);
//       refreshHistory(); // 刷新侧边栏标题
//     }

//     setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
//     setInput("");
//     setLoading(true);

//     try {
//       const response = await fetch("/api/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ messages: [...messages, userMsg] }),
//       });

//       if (!response.body) throw new Error("No body");

//       const reader = response.body.getReader();
//       const decoder = new TextDecoder();
//       let accumulated = "";

//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         const chunk = decoder.decode(value);
//         accumulated += chunk;

//         setMessages((prev) => {
//           const updated = [...prev];
//           updated[updated.length - 1].content = accumulated;
//           return updated;
//         });
//       }

//       // 2. 流结束后，将完整的回复存入数据库
//       await saveMessageAction({
//         chatId: activeChatId,
//         role: "assistant",
//         content: accumulated,
//       });

//     } catch (err) {
//       console.error("Streaming error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };
//   return (
//     <div className="flex h-screen bg-white">
//       {/* <aside className="w-64 bg-slate-900 flex flex-col text-slate-300 flex-shrink-0">
//         <div className="p-4 border-b border-slate-800">
//           <button
//             onClick={handleNewChat}
//             className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium"
//           >
//             <Plus className="w-4 h-4" /> 新建对话
//           </button>
//         </div>
//         <div className="flex-1 overflow-y-auto p-2 space-y-1">
//           {history.length === 0 ? (
//             <div className="text-xs text-slate-500 text-center mt-4">暂无历史记录</div>
//           ) : (
//             history.map((chat) => (
//               <button
//                 key={chat.id}
//                 onClick={() => handleSelectChat(chat.id)}
//                 className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left group ${currentChatId === chat.id ? "bg-slate-800 text-white shadow-sm" : "hover:bg-slate-800"
//                   }`}
//               >
//                 <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-70" />
//                 <span className="truncate">{chat.title}</span>
//               </button>
//             ))
//           )}
//         </div>
//       </aside> */}
//       <aside className="w-64 bg-slate-900 flex flex-col text-slate-300 flex-shrink-0">
//         {/* 顶部：新建对话 */}
//         <div className="p-4 border-b border-slate-800">
//           <button
//             onClick={handleNewChat}
//             className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium shadow-lg active:scale-95"
//           >
//             <Plus className="w-4 h-4" /> 新建对话
//           </button>
//         </div>

//         {/* 中间：功能管理区 */}
//         <div className="p-2 border-b border-slate-800 space-y-1">
//           <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
//             管理控制台
//           </p>
//           <button
//             onClick={() => window.location.href = '/knowledge-base'} // 或者使用 Next.js 的 useRouter/Link
//             className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group"
//           >
//             <FileText className="w-4 h-4 opacity-70 group-hover:text-blue-400" />
//             <span>知识库管理</span>
//           </button>
//           <button
//             onClick={() => window.location.href = '/graph'}
//             className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group"
//           >
//             <Share2 className="w-4 h-4 opacity-70 group-hover:text-purple-400" />
//             <span>知识图谱管理</span>
//           </button>
//         </div>

//         {/* 底部：聊天历史记录 */}
//         <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
//           <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
//             历史对话记录
//           </p>
//           {history.length === 0 ? (
//             <div className="text-xs text-slate-600 text-center mt-4 italic">暂无历史记录</div>
//           ) : (
//             history.map((chat) => (
//               <button
//                 key={chat.id}
//                 onClick={() => handleSelectChat(chat.id)}
//                 className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left group ${currentChatId === chat.id
//                     ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700"
//                     : "hover:bg-slate-800"
//                   }`}
//               >
//                 <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-70" />
//                 <span className="truncate">{chat.title}</span>
//               </button>
//             ))
//           )}
//         </div>
//       </aside>

//       {/* 右侧主聊天区域 */}
//       <main className="flex-1 flex flex-col h-full bg-slate-50/30">


//         {/* 消息展示区 */}
//         <div className="flex-1 overflow-y-auto p-6">
//           <div className="max-w-4xl mx-auto space-y-6">
//             {messages.length === 0 && (
//               <div className="text-center text-slate-400 mt-20 space-y-2">
//                 <div className="text-4xl">👋</div>
//                 <p>请上传文档并开始关于飞机的技术咨询...</p>
//               </div>
//             )}
//             {messages.map((msg, idx) => (

//               <div key={idx} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>

//                 {/* 消息主体 */}
//                 <div className={`relative p-4 rounded-2xl max-w-[90%] shadow-sm transition-all ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
//                   }`}>

//                   {editingIndex === idx ? (
//                     <div className="flex flex-col gap-2 min-w-[200px]">
//                       <textarea
//                         className="w-full bg-transparent border-b border-white/50 focus:outline-none resize-none"
//                         value={editContent}
//                         onChange={(e) => setEditContent(e.target.value)}
//                         autoFocus
//                       />
//                       <div className="flex justify-end gap-2">
//                         <button onClick={() => saveEdit(idx)} className="p-1 hover:bg-white/20 rounded"><Check className="w-4 h-4" /></button>
//                         <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
//                       </div>
//                     </div>
//                   ) : (
//                     <>
//                       {/* <article className={`prose prose-sm max-w-none break-words ${msg.role === "user" ? "prose-invert" : ""}`}>
//                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
//                       </article> */}
//                       <article className={`prose prose-sm max-w-none break-words ${msg.role === "user" ? "prose-invert" : ""}`}>
//                         <ReactMarkdown
//                           remarkPlugins={[remarkGfm, remarkMath]}
//                           rehypePlugins={[rehypeKatex]}
//                         >
//                           {msg.content}
//                         </ReactMarkdown>
//                       </article>


//                       {/* 操作按钮栏：仅在鼠标悬浮消息时显示 */}
//                       <div className={`absolute -bottom-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "right-0 flex-row-reverse" : "left-0"}`}>
//                         <button
//                           onClick={() => handleCopy(msg.content)}
//                           className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
//                           title="复制内容"
//                         >
//                           <Copy className="w-3.5 h-3.5" />
//                         </button>
//                         {msg.role === "user" && (
//                           <button
//                             onClick={() => startEditing(idx, msg.content)}
//                             className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
//                             title="修改消息"
//                           >
//                             <Edit3 className="w-3.5 h-3.5" />
//                           </button>
//                         )}
//                       </div>
//                     </>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* 底部输入框区域 - 集成了上传功能 */}
//         <div className="p-4 bg-white border-t">
//           <div className="max-w-4xl mx-auto">
//             {/* 上传状态提示语 - 仅在有状态时显示 */}
//             {uploadStatus && (
//               <div className="mb-2 px-2 flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse">
//                 {loading && <Loader2 className="w-3 h-3 animate-spin" />}
//                 {uploadStatus}
//               </div>
//             )}

//             <div className="relative flex items-center">
//               {/* 文件上传按钮 */}
//               <label className="absolute left-3 p-2 text-slate-400 hover:text-blue-600 cursor-pointer transition-colors z-10">
//                 {loading ? (
//                   <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
//                 ) : (
//                   <FileText className="w-5 h-5" />
//                 )}
//                 <input
//                   type="file"
//                   className="hidden"
//                   onChange={handleUpload}
//                   accept=".pdf,.txt,.md"
//                   disabled={loading}
//                 />
//               </label>
//               {/* 输入框 */}
//               <input
//                 className="w-full border border-slate-200 rounded-xl pl-12 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 transition-all"
//                 placeholder={loading ? "处理文件中..." : "输入你的问题..."}
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleSend()}
//                 disabled={loading}
//               />

//               {/* 发送按钮 */}
//               <button
//                 onClick={handleSend}
//                 disabled={loading || !input.trim()}
//                 className="absolute right-2 p-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
//               >
//                 <Send className="w-4 h-4" />
//               </button>
//             </div>

//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

"use client";

import { useState, useEffect, useRef } from "react";
import { uploadAndIndex, getChatList, getChatMessages, saveMessageAction } from "@/app/actions/chat";
import { Upload, Send, FileText, Loader2, MessageSquare, Plus, Copy, Edit3, Check, X, Share2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 从 URL 获取 id: http://localhost:3000/chat?id=xxxx
  const chatIdFromUrl = searchParams.get("id");
  const [loading, setLoading] = useState(false);
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

  // 1. 核心：监听 URL 参数变化
  useEffect(() => {
    if (chatIdFromUrl) {
      loadChatData(chatIdFromUrl);
    } else {
      // 如果 URL 没有 id，说明是新对话
      handleNewChat();
    }
  }, [chatIdFromUrl]); // 只要 id 变了，就执行

  // 2. 加载指定对话数据
  const loadChatData = async (id: string) => {
    setLoading(true);
    setCurrentChatId(id);
    try {
      const msgs = await getChatMessages(id);
      setMessages(msgs);
    } catch (error) {
      console.error("加载失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化获取侧边栏
  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]); // 每当消息变化时触发

  const refreshHistory = async () => {
    const list = await getChatList();
    console.log("------------------------------", list)
    setHistory(list);
  };

  // const handleSelectChat = async (id: string) => {
  //   if (loading) return;
  //   setCurrentChatId(id);
  //   const msgs = await getChatMessages(id);
  //   setMessages(msgs);
  // };
  const handleSelectChat = (id: string) => {
    // 跳转到新的 URL，Home 页面会通过监听参数自动加载数据
    router.push(`/chat?id=${id}`);
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    // 如果当前 URL 有 id 但用户点了新建，则清空 URL
    if (searchParams.get("id")) {
      router.push("/chat");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input;
    const userMsg = { role: "user", content: userText };

    // 保存消息
    const activeChatId = await saveMessageAction({
      chatId: currentChatId || undefined,
      role: "user",
      content: userText,
    });

    // 如果是新开的对话，跳转到带 ID 的 URL
    if (!currentChatId) {
      router.push(`/chat?id=${activeChatId}`);
      // 这里的 useEffect [chatIdFromUrl] 会负责刷新消息列表
    }

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

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

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = accumulated;
          return updated;
        });
      }

      // 2. 流结束后，将完整的回复存入数据库
      await saveMessageAction({
        chatId: activeChatId,
        role: "assistant",
        content: accumulated,
      });

    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setLoading(false);
    }
  };





  return (
    <div className="flex h-screen bg-white">

      <aside className="w-64 bg-slate-900 flex flex-col text-slate-300 flex-shrink-0">
        {/* 顶部：新建对话 */}
        <div className="p-4 border-b border-slate-800">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" /> 新建对话
          </button>
        </div>

        {/* 中间：功能管理区 */}
        <div className="p-2 border-b border-slate-800 space-y-1">
          <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            管理控制台
          </p>
          <button
            onClick={() => window.location.href = '/knowledge-base'} // 或者使用 Next.js 的 useRouter/Link
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group"
          >
            <FileText className="w-4 h-4 opacity-70 group-hover:text-blue-400" />
            <span>知识库管理</span>
          </button>
          <button
            onClick={() => window.location.href = '/graph'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group"
          >
            <Share2 className="w-4 h-4 opacity-70 group-hover:text-purple-400" />
            <span>知识图谱管理</span>
          </button>
        </div>

        {/* 底部：聊天历史记录 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            历史对话记录
          </p>
          {history.length === 0 ? (
            <div className="text-xs text-slate-600 text-center mt-4 italic">暂无历史记录</div>
          ) : (
            history.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left group ${currentChatId === chat.id
                  ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700"
                  : "hover:bg-slate-800"
                  }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span className="truncate">{chat.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

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
                      {/* <article className={`prose prose-sm max-w-none break-words ${msg.role === "user" ? "prose-invert" : ""}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </article> */}
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
            {/* 上传状态提示语 - 仅在有状态时显示 */}
            {uploadStatus && (
              <div className="mb-2 px-2 flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse">
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {uploadStatus}
              </div>
            )}

            <div className="relative flex items-center">
              {/* 文件上传按钮 */}
              <label className="absolute left-3 p-2 text-slate-400 hover:text-blue-600 cursor-pointer transition-colors z-10">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  accept=".pdf,.txt,.md"
                  disabled={loading}
                />
              </label>
              {/* 输入框 */}
              <input
                className="w-full border border-slate-200 rounded-xl pl-12 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 transition-all"
                placeholder={loading ? "处理文件中..." : "输入你的问题..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={loading}
              />

              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 p-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}