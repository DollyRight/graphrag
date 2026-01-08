"use client";

import { useEffect, useState } from "react";
import {
  getKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  updateKnowledgeBase,
  initDefaultKB
} from "@/app/actions/knowledge";
import { Plus, Database, FileText, ChevronRight, MoreVertical, Trash2, Edit3, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast"; // 建议安装 react-hot-toast 处理提示
import Sidebar from "../components/Sidebar";
import { useSearchParams, useRouter } from "next/navigation";
export default function KBPage() {
  const [kbs, setKbs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 弹窗状态
  const [modalType, setModalType] = useState<"create" | "edit" | null>(null);
  const [currentKB, setCurrentKB] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const router = useRouter();
  const loadData = async () => {
    setLoading(true);
    // await initDefaultKB();
    const data = await getKnowledgeBases();
    setKbs(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // 处理提交（创建或修改）
  const handleSubmit = async () => {
    if (!formData.name) return alert("名称不能为空");

    if (modalType === "create") {
      await createKnowledgeBase(formData);
    } else if (modalType === "edit" && currentKB) {
      await updateKnowledgeBase(currentKB._id, formData);
    }

    closeModal();
    loadData();
  };

  // 处理删除
  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) return alert("默认知识库不能删除");
    if (!confirm("确定要删除该知识库吗？这将无法恢复。")) return;

    const res = await deleteKnowledgeBase(id);
    if (res.success) {
      loadData();
    } else {
      alert(res.error);
    }
  };

  const openEditModal = (kb: any) => {
    setCurrentKB(kb);
    setFormData({ name: kb.name, description: kb.description || "" });
    setModalType("edit");
  };

  const closeModal = () => {
    setModalType(null);
    setCurrentKB(null);
    setFormData({ name: "", description: "" });
  };

  // 1. 定义接口
  interface KnowledgeBase {
    _id: string;
    name: string;
    description?: string;
    isDefault: boolean; // 确保包含此属性
    // ... 其他你需要的属性
  }

  // 2. 在组件内部使用
  const sortedKbs = (kbs as KnowledgeBase[]).sort((a, b) => {
    // 现在 a 和 b 都是 KnowledgeBase 类型，不再报错
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return 0;
  });
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 侧边栏保持不动 */}
      <Sidebar />

      {/* 主内容区域：设置为 overflow-y-auto */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto scroll-smooth">

        {/* 顶部标题栏：增加内边距和背景渐变，使其更具层次感 */}
        <header className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md px-8 py-8 flex justify-between items-end transition-all">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">知识库管理</h1>
            <p className="text-slate-500 mt-1.5 font-medium">构建、编辑和组织您的私有知识空间</p>
          </div>

          <button
            onClick={() => setModalType("create")}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            <span className="font-semibold">新建知识库</span>
          </button>
        </header>

        {/* 卡片列表容器：增加响应式内边距和最大宽度限制 */}
        <div className="px-8 pb-12 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {sortedKbs.map((kb: any) => (
              <div
                key={kb._id}
                className="bg-white border border-slate-200/60 rounded-3xl p-6 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 hover:border-blue-400/50 transition-all duration-300 group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className="p-3.5 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-200 transition-all duration-300">
                      <Database className="w-6 h-6" />
                    </div>

                    {/* 操作按钮组：默认半透明，悬浮时增强 */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(kb); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {!kb.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(kb._id, kb.isDefault); }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="删除记录"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-800 text-xl truncate">{kb.name}</h3>
                      {kb.isDefault && (
                        <span className="flex items-center gap-1 text-[10px] bg-blue-100/50 text-blue-700 px-2 py-0.5 rounded-lg font-bold border border-blue-200/50">
                          默认库
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 h-10 overflow-hidden">
                      {kb.description || "暂无详细描述，点击进入库进行管理。"}
                    </p>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-300" />
                      {/* 0 份文件 */}
                      {kb.fileCount || 0}份文件
                    </span>
                  </div>

                  {/* <button className="text-blue-600 text-sm font-bold flex items-center gap-1 group/btn">
                    进入库
                    <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </button> */}
                  <button
                    onClick={() => router.push(`/knowledge-base/${kb._id}`)}
                    className="text-blue-600 text-sm font-bold flex items-center gap-1 group/btn"
                  >
                    进入库
                    <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 弹窗部分样式优化 */}
        {modalType && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 pb-4 border-b border-slate-50">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  {modalType === "create" ? "创建新知识库" : "编辑知识库"}
                </h2>
              </div>

              <div className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">知识库名称</label>
                  <input
                    autoFocus
                    className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none ring-2 ring-transparent focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                    placeholder="例如：技术维修手册"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">描述内容</label>
                  <textarea
                    className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none ring-2 ring-transparent focus:ring-blue-500/20 focus:bg-white transition-all h-32 resize-none text-slate-800 placeholder:text-slate-400"
                    placeholder="简要描述该知识库包含的内容..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-8 pt-0 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                >
                  保存确认
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}