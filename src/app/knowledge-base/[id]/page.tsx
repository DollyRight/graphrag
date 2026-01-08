"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, FileText, Upload, Trash2,
    RefreshCw, Search, CheckCircle2, Clock,
    AlertCircle, HardDrive, Filter, Loader2
} from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
// 导入你提供的 Action
import { getDocumentsByKB, getKnowledgeBases } from "@/app/actions/knowledge";
import { uploadAndIndex } from "@/app/actions/chat";
import { toast, Toaster } from "react-hot-toast";

export default function KBDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15 推荐使用 use() 处理 params
    const { id: kbId } = use(params);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [kbInfo, setKbInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const [uploadLoading, setUploadLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. 获取文件列表
            const docs = await getDocumentsByKB(kbId);
            // console.log("docs", docs)
            setFiles(docs);


            // 2. 获取当前知识库的名称（从列表 Action 中查找或单独写个 getKBById）
            const allKBs = await getKnowledgeBases();
            const current = allKBs.find((item: any) => item._id === kbId);
            setKbInfo(current);
        } catch (error) {
            console.error("加载失败", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [kbId]);

    //   // 过滤后的文件列表
    //   const filteredFiles = files.filter(f => 
    //     f.name.toLowerCase().includes(searchQuery.toLowerCase())
    //   );
    const filteredFiles = files.filter(f => {
        const fileName = f?.name || ""; // 如果 name 为空，给一个默认字符串
        return fileName.toLowerCase().includes(searchQuery.toLowerCase());
    });


    // 处理上传逻辑
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !kbId) return;

        setUploadLoading(true);
        const toastId = toast.loading(`正在上传并解析 ${file.name}...`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("kbId", kbId);

        try {
            const res = await uploadAndIndex(formData);
            loadData();
            //TODO上传了就过了，后台处理
            if (res.error) {
                toast.error(`错误: ${res.error}`, { id: toastId });
            } else {
                toast.success("文档索引成功！", { id: toastId });
                loadData(); // 重新加载列表显示新文件
            }
        } catch (err) {
            toast.error("上传失败，请稍后再试", { id: toastId });
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // 重置 input
        }
    };
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* 顶部导航与标题 */}
                <header className="bg-white border-b border-slate-200 px-8 py-5">
                    <button
                        onClick={() => router.push("/knowledge-base")}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors mb-3 text-sm font-medium group"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                        知识库中心
                    </button>

                    <div className="flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-100">
                                    <HardDrive className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {kbInfo?.name || "加载中..."}
                                </h1>
                            </div>
                            <p className="text-slate-500 mt-1 text-sm max-w-xl truncate">
                                {kbInfo?.description || "暂无描述"}
                            </p>
                        </div>

                        <div className="flex gap-2.5">
                            <button
                                onClick={loadData}
                                className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                                title="刷新数据"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            {/* <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm font-bold">
                                <Upload className="w-4 h-4" />
                                上传新文档
                            </button> */}
                            {/* 隐藏的 File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleUpload}
                                accept=".pdf,.txt,.md,.docx"
                                disabled={uploadLoading}
                            />

                            {/* 触发按钮 */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm font-bold"
                            >
                                {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploadLoading ? "正在处理..." : "上传新文档"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-6xl mx-auto space-y-6">

                        {/* 过滤器 & 状态统计 */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="搜索文件名..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all shadow-sm"
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-slate-200/50 p-1.5 rounded-xl">
                                <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-xs font-bold text-slate-600">
                                    全部: {files.length}
                                </div>
                                <div className="px-3 py-1 text-xs font-bold text-slate-500">
                                    索引中: {files.filter(f => f.status === 'processing').length}
                                </div>
                            </div>
                        </div>

                        {/* 文件列表表格 */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">名称</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">处理状态</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">文件大小</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">添加日期</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">管理</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredFiles.map((file) => (
                                        <tr key={file._id} className="group hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-700 truncate max-w-[240px]">
                                                            {file.fileName}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono">ID: {file._id.slice(-8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={file.status || 'indexed'} />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                                {file.size || '未知'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">
                                                {new Date(file.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="删除文档"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* 空状态 */}
                            {!loading && filteredFiles.length === 0 && (
                                <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <Search className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <p className="text-sm font-medium">未找到相关文档</p>
                                    <p className="text-xs mt-1">尝试更换搜索关键词或上传新文件</p>
                                </div>
                            )}

                            {/* 加载中 */}
                            {loading && (
                                <div className="p-20 flex flex-col items-center justify-center gap-3">
                                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                                    <span className="text-sm text-slate-500 font-medium">获取数据中...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// 状态标签子组件优化
function StatusBadge({ status }: { status: string }) {
    const configs: any = {
        completed: { icon: CheckCircle2, text: "已就绪", color: "text-green-600 bg-green-50 border-green-100" },
        indexing: { icon: RefreshCw, text: "索引中", color: "text-blue-600 bg-blue-50 border-blue-100" },
        processing: { icon: RefreshCw, text: "向量化中", color: "text-blue-600 bg-blue-50 border-blue-100" },
        failed: { icon: AlertCircle, text: "失败", color: "text-red-600 bg-red-50 border-red-100" },
        pending: { icon: Clock, text: "排队中", color: "text-slate-500 bg-slate-50 border-slate-100" },
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    const isSpinning = status === 'indexing' || status === 'processing';

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${config.color}`}>
            <Icon className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
            {config.text}
        </span>
    );
}