// "use server";

// import neo4j from "neo4j-driver";

// const driver = neo4j.driver(
//     process.env.NEO4J_URI || "bolt://localhost:7687",
//     neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password")
// );

// export async function getGraphData() {
    
//     const session = driver.session();
//     try {
//         // 限制读取 100 条关系，防止页面卡死
//         const result = await session.run(
//             `MATCH (n)-[r]->(m) 
//        RETURN n, r, m LIMIT 100`
//         );

//         const nodes = new Map();
//         const links: any[] = [];

//         result.records.forEach((record) => {
//             const n = record.get("n");
//             const m = record.get("m");
//             const r = record.get("r");

//             // 处理起始节点
//             nodes.set(n.elementId, {
//                 id: n.elementId,
//                 label: n.properties.name || n.properties.id || "Unknown",
//                 type: n.labels[0],
//             });

//             // 处理目标节点
//             nodes.set(m.elementId, {
//                 id: m.elementId,
//                 label: m.properties.name || m.properties.id || "Unknown",
//                 type: m.labels[0],
//             });

//             // 处理关系
//             links.push({
//                 source: n.elementId,
//                 target: m.elementId,
//                 label: r.type,
//             });
//         });
//         console.log(nodes)
//         return {
//             nodes: Array.from(nodes.values()),
//             links,
//         };
//     } finally {
//         await session.close();
//     }
// }
"use server";

import neo4j from "neo4j-driver";

const driver = neo4j.driver(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password")
);

export async function getGraphData() {
    const session = driver.session();
    try {
        /**
         * 修改后的 Cypher：
         * 1. 先 MATCH (n) 获取所有节点
         * 2. 使用 OPTIONAL MATCH 获取这些节点之间可能存在的关系 [r]
         * 这样即使 r 为空，n 也会被返回
         */
        const result = await session.run(
            `MATCH (n)
             OPTIONAL MATCH (n)-[r]->(m)
             RETURN n, r, m 
             LIMIT 200` 
        );

        const nodes = new Map();
        const links: any[] = [];

        result.records.forEach((record) => {
            const n = record.get("n");
            const r = record.get("r");
            const m = record.get("m");

            // 1. 处理节点 n (始终存在)
            if (n) {
                nodes.set(n.elementId, {
                    id: n.elementId,
                    label: n.properties.name || n.properties.id || n.properties.content?.substring(0, 10) || "Unknown",
                    type: n.labels[0] || "Entity",
                });
            }

            // 2. 如果存在关系 r，则处理关系和目标节点 m
            if (r && m) {
                // 确保目标节点也被加入 Map
                if (!nodes.has(m.elementId)) {
                    nodes.set(m.elementId, {
                        id: m.elementId,
                        label: m.properties.name || m.properties.id || m.properties.content?.substring(0, 10) || "Unknown",
                        type: m.labels[0] || "Entity",
                    });
                }

                // 添加关系
                links.push({
                    source: n.elementId,
                    target: m.elementId,
                    label: r.type,
                });
            }
        });

        return {
            nodes: Array.from(nodes.values()),
            links,
        };
    } catch (error) {
        console.error("Neo4j Query Error:", error);
        throw error;
    } finally {
        await session.close();
    }
}


export async function clearGraphDatabase() {
    const session = driver.session();
    try {
        // 使用 DETACH DELETE 删除所有节点及与其相关的关系
        await session.run(`MATCH (n) DETACH DELETE n`);
        return { success: true, message: "知识库已完全清空" };
    } catch (error) {
        console.error("清空数据库失败:", error);
        return { success: false, error: "清空失败，请检查数据库连接" };
    } finally {
        await session.close();
    }
}