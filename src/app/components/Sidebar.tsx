"use client";

import { useState, useEffect } from "react";
import { Plus, FileText, Share2, Trash2, MessageSquare, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { getChatList, getChatMessages, } from "../actions/chat";
import { useSearchParams, useRouter } from "next/navigation";

export default function Sidebar({ }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();
    const [history, setHistory] = useState<any[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    // 获取当前 URL 里的 id 参数 (例如: /chat?id=123)
    const currentIdFromUrl = searchParams.get("id");
    // 初始化获取侧边栏
    useEffect(() => {
        refreshHistory();
    }, []);
    /**
         * 2. 核心改进：监听 URL 中 id 的变化
         * 当 id 存在，且当前 history 列表中找不到这个 id 时，说明是一个刚创建的对话
         * 此时主动调用 refreshHistory 同步数据库最新的列表
         */
    useEffect(() => {
        if (currentIdFromUrl) {
            const exists = history.find(chat => chat.id === currentIdFromUrl);
            if (!exists) {
                refreshHistory();
            }
        }
    }, [currentIdFromUrl, history]); // 依赖项包含 id 和 history
    const refreshHistory = async () => {
        const list = await getChatList();
        setHistory(list);
    };

    const handleSelectChat = (id: string) => {
        // 跳转到新的 URL，Home 页面会通过监听参数自动加载数据
        router.push(`/chat?id=${id}`);
    };

    const handleNewChat = () => {
        setCurrentChatId(null);
        setMessages([]);
        // // 如果当前 URL 有 id 但用户点了新建，则清空 URL
        // if (searchParams.get("id")) {
        //     router.push("/chat");
        // }
        router.push("/chat");
    };

    return (
        <aside className={`${isCollapsed ? "w-16" : "w-64"} bg-slate-900 flex flex-col text-slate-300 flex-shrink-0 transition-all duration-300 relative border-r border-slate-800 h-screen`}>

            {/* 收起/展开按钮 */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-10 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white z-50 shadow-md"
            >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>
            {/* 顶部：新建对话 */}
            <div className="p-4 border-b border-slate-800 space-y-1">
                {!isCollapsed && (<span>Graph rag系统</span>)}


            </div>
            {/* 顶部：新建对话 */}
            <div className="p-4 border-b border-slate-800 space-y-1">

                <button
                    onClick={handleNewChat}
                    className={`w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium shadow-lg active:scale-95 ${isCollapsed ? "px-0" : ""}`}
                >
                    <Plus className="w-4 h-4" />
                    {!isCollapsed && <span>新建对话</span>}
                </button>
            </div>

            {/* 中间：管理控制台 (知识库、图谱) */}
            <div className="p-2 border-b border-slate-800 space-y-1">
                {!isCollapsed && (
                    <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        知识管理
                    </p>
                )}
                <button
                    onClick={() => window.location.href = '/knowledge-base'}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group ${pathname === '/knowledge-base' ? 'bg-slate-800 text-white' : ''}`}
                >
                    <FileText className="w-4 h-4 opacity-70 group-hover:text-blue-400" />
                    {!isCollapsed && <span>知识库管理</span>}
                </button>
                <button
                    onClick={() => window.location.href = '/graph'}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left hover:bg-slate-800 hover:text-white group ${pathname === '/graph' ? 'bg-slate-800 text-white' : ''}`}
                >
                    <Share2 className="w-4 h-4 opacity-70 group-hover:text-purple-400" />
                    {!isCollapsed && <span>知识图谱管理</span>}
                </button>

            </div>

            {/* 底部：聊天历史记录 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 
                /* 隐藏 IE 和旧版 Firefox 滚动条 */
                scrollbar-hide
                /* Chrome, Safari, Edge 滚动条美化 */
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-slate-700/50
                [&::-webkit-scrollbar-thumb]:rounded-full
                hover:[&::-webkit-scrollbar-thumb]:bg-slate-600
                active:[&::-webkit-scrollbar-thumb]:bg-slate-500">
                {!isCollapsed && (
                    <>
                        <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">历史对话记录</p>
                        {/* <button
                            onClick={handleNewChat}
                            className={`w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium shadow-lg active:scale-95 ${isCollapsed ? "px-0" : ""}`}
                        >
                            <Plus className="w-4 h-4" />
                            {!isCollapsed && <span>新建对话</span>}
                        </button> */}
                    </>

                )}
                {/* <button
                    onClick={handleNewChat}
                    className={`w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-sm font-medium shadow-lg active:scale-95 ${isCollapsed ? "px-0" : ""}`}
                >
                    <Plus className="w-4 h-4" />
                    {!isCollapsed && <span>新建对话</span>}
                </button> */}
                {history.map((chat) => {
                    // 核心比对逻辑：当前 URL 的 id 是否等于这条记录的 id
                    const isActive = currentIdFromUrl === chat.id;

                    return (
                        <button
                            key={chat.id}
                            onClick={() => handleSelectChat(chat.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left group
                                ${isActive
                                    ? "bg-slate-800 text-white shadow-sm ring-slate-700"
                                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            <MessageSquare className={`w-4 h-4 flex-shrink-0 opacity-70 ${isActive ? 'text-blue-400' : ''}`} />
                            {!isCollapsed && <span className="truncate">{chat.title}</span>}
                        </button>
                    );
                })}
            </div>
            <div className="p-2 border-t border-slate-800">
                <button
                    onClick={() => router.push('/settings')}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all group
                        ${pathname === '/settings'
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                >
                    <div className="relative">
                        <Settings className={`w-4 h-4 flex-shrink-0 transition-transform duration-700 group-hover:rotate-90 ${pathname === '/settings' ? 'text-blue-400' : ''}`} />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-1 justify-between items-center">
                            <span className="font-medium">系统设置</span>
                            <span className="text-[10px] text-slate-600 font-mono">v1.0</span>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    );
}

