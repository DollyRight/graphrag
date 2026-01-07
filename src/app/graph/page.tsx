
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getGraphData, clearGraphDatabase } from "@/app/actions/graph"; // 确保引入了 clearGraphDatabase
import { Loader2, RefreshCw, ZoomIn, Trash2,Share2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
// 禁用 SSR 导入可视化组件
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
});

// 定义节点和连线的类型接口
interface GraphNode {
    id: string;
    label: string;
    type: string;
    color?: string;
    x?: number;
    y?: number;
}

interface GraphLink {
    source: string;
    target: string;
    label: string;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export default function GraphVisualizePage() {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [isClearing, setIsClearing] = useState(false); // 新增：清空状态控制

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getGraphData();
            setGraphData(data as GraphData);
        } catch (err) {
            console.error("Failed to fetch graph:", err);
        } finally {
            setLoading(false);
        }
    };

    // 新增：处理清空数据库逻辑
    const handleClearDatabase = async () => {
        if (!confirm("警告：确定要彻底清空 Neo4j 中的所有节点和关系吗？此操作不可恢复。")) {
            return;
        }

        setIsClearing(true);
        try {
            const res = await clearGraphDatabase();
            if (res.success) {
                alert("数据库已成功清空");
                setGraphData({ nodes: [], links: [] }); // 即时清空 UI 上的数据
            } else {
                alert(`清空失败: ${res.error}`);
            }
        } catch (err) {
            console.error("Clear error:", err);
            alert("执行清空操作时发生错误");
        } finally {
            setIsClearing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            <Sidebar />
            {/* 顶部控制栏 */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 px-8 py-4 flex justify-between items-center shadow-sm">
                    {/* 左侧：标题与状态标识 */}
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Share2 className="w-6 h-6" /> {/* 建议引入 Share2 图标代表图谱 */}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    知识图谱预览
                                </h1>
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    NEO4J 已连接
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                探索实体间的关联关系与深度语义网络
                            </p>
                        </div>
                    </div>

                    {/* 右侧：操作区域 */}
                    <div className="flex items-center gap-3">
                        {/* 清空按钮：更高级的淡色警示风格 */}
                        <button
                            onClick={handleClearDatabase}
                            disabled={loading || isClearing}
                            className="group flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50/50 px-4 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 text-sm font-semibold active:scale-95"
                        >
                            {isClearing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                            )}
                            清空数据
                        </button>

                        {/* 分割线 */}
                        <div className="w-px h-6 bg-slate-200 mx-1" />

                        {/* 刷新按钮：与主色调一致的高亮风格 */}
                        <button
                            onClick={fetchData}
                            disabled={loading || isClearing}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 text-sm font-semibold shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            刷新视图
                        </button>
                    </div>
                </header>

                {/* 图谱绘制区 */}
                <div className="flex-1 relative overflow-hidden bg-slate-100">
                    {loading && !isClearing ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                                <p className="text-slate-500 font-medium">正在读取图谱结构...</p>
                            </div>
                        </div>
                    ) : (
                        <ForceGraph2D
                            graphData={graphData}
                            d3AlphaDecay={0.02}
                            d3VelocityDecay={0.3}
                            nodeLabel={(node: any) => `${node.type}: ${node.label}`}
                            nodeAutoColorBy="type"
                            linkDirectionalParticles={2}
                            linkDirectionalParticleSpeed={0.005}
                            linkLabel={(link: any) => link.label}
                            nodeCanvasObject={(node: any, ctx, globalScale) => {
                                const label = node.label;
                                const fontSize = 12 / globalScale;
                                ctx.font = `${fontSize}px Sans-Serif`;
                                ctx.textAlign = "center";
                                ctx.textBaseline = "middle";
                                ctx.fillStyle = node.color;
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                                ctx.fill();

                                ctx.fillStyle = "#334155";
                                ctx.fillText(label, node.x, node.y + 10);
                            }}
                            cooldownTicks={100}
                        />
                    )}
                </div>

                {/* 底部提示 */}
                <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-5 py-2 border border-slate-200 rounded-full shadow-xl text-[10px] text-slate-500 flex gap-6 pointer-events-none z-10">
                    <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3 text-blue-500" /> 滚轮缩放</span>
                    <span>•</span>
                    <span>左键拖拽节点</span>
                    <span>•</span>
                    <span>右键平移画布</span>
                </footer>
            </div>

        </div>
    );
}