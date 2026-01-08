"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, MessageSquare, MoreVertical, Pencil, Check, X } from "lucide-react";
import { updateChatTitleAction, deleteChatAction } from "../actions/chat";

// --- 子组件：单个历史记录项 ---
export default function ChatHistoryItem({ chat, isActive, isCollapsed, onSelect, refreshHistory }: any) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(chat.title);
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleRename = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editValue.trim() && editValue !== chat.title) {
            await updateChatTitleAction(chat.id, editValue);
            refreshHistory();
        }
        setIsEditing(false);
        setIsMenuOpen(false);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("确定要删除这段对话吗？")) {
            await deleteChatAction(chat.id);
            refreshHistory();
        }
        setIsMenuOpen(false);
    };

    if (isCollapsed) {
        return (
            <button
                onClick={() => onSelect(chat.id)}
                className={`w-full flex justify-center py-3 transition-colors ${isActive ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
            >
                <MessageSquare className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="group relative px-2 mb-1">
            {isEditing ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg ring-1 ring-blue-500">
                    <input
                        autoFocus
                        className="bg-transparent text-sm text-white outline-none w-full"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename(e as any)}
                    />
                    <Check className="w-4 h-4 text-green-500 cursor-pointer" onClick={handleRename} />
                    <X className="w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setIsEditing(false)} />
                </div>
            ) : (
                <div
                    onClick={() => onSelect(chat.id)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm cursor-pointer transition-all duration-200
                        ${isActive
                            ? "bg-[#D3E3FD] text-[#041E49] font-medium"
                            : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <div className="flex items-center gap-3 truncate flex-1">
                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#041E49]" : "opacity-70"}`} />
                        <span className="truncate">{chat.title}</span>
                    </div>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className={`p-1 rounded-full hover:bg-black/10 transition-opacity
                                ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                                ${isActive ? "text-[#041E49]" : "text-slate-400"}
                            `}
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-8 z-[100] w-36 bg-white shadow-2xl border border-slate-200 rounded-xl py-1 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); setIsMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> 重命名
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> 删除
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}