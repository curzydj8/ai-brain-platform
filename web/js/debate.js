/* AI Brain Platform · debate.js
* 辩论引擎（纯函数，可 Node 单测）：
* 建议题 → 生成提问 → 启发式差异分析（本地）→ 生成追问 → 共识报告。
*/
(() => {
"use strict";

const NS = (window.AIBrain = window.AIBrain || {});

/* ---------------- 议题 CRUD ---------------- */
function listDebates() { return NS.Core.Store.load().debates;}
function getDebate(id) { return listDebates().find(d => d.id === id);}
function saveDebate(debate) {
const s = NS.Core.Store.load();
const i = s.debates.findIndex(d => d.id === debate.id);
if (i >= 0) s.debates[i] = debate; else s.debates.unshift(debate);
NS.Core.Store.save();
}
function deleteDebate(id) {
const s = NS.Core.Store.load();
s.debates = s.debates.filter(d => d.id!== id);
NS.Core.Store.save();
}
function createDebate({ topic, background, constraints}) {
const agents = NS.Agents.enabledAgents();
const debate = {
id: NS.Core.uid("debate"),
topic: topic.trim(),
background: (background || "").trim(),
constraints: (constraints || "").trim(),
createdAt: NS.Core.nowISO(),
status: "collecting",
agentIds: agents.map(a => a.id),
rounds: [],
report: null,
};
const round = newRound(debate, 1, null);
debate.rounds.push(round);
saveDebate(debate);
return debate;
}
function newRound(debate, n, analysis) {
const questions = {};
for (const aid of debate.agentIds) {
const agent = NS.Agents.getAgent(aid);
questions[aid] = buildQuestion(debate, n, agent, analysis);
}
return { n, questions, answers: {}, analysis: null, createdAt: NS.Core.nowISO()};
}
function roundComplete(debate, round) {
return debate.agentIds.every(aid => (round.answers[aid] || "").trim().length > 0);
}

/* ---------------- 提问生成 ---------------- */
function briefBlock(debate) {
let s = "「议题」" + debate.topic + "\n";
if (debate.background) s += "「背景」" + debate.background + "\n";
if (debate.constraints) s += "「约束条件」" + debate.constraints + "\n";
return s;
}
function buildQuestion(debate, n, agent, analysis) {
const roleLine = "你是「" + agent.name + "」（" + agent.role + "），专长：" +
agent.strengths.join("、") + "。";
const formatReq = "请用中文结构化回答（300~600 字），分四节：1.核心判断 2.关键论据 3.风险提示 4.行动建议。";
if (n === 1 ||!analysis) {
return roleLine + "\n" + briefBlock(debate) +
"请从你的专业视角给出独立判断，不要迎合其他 AI。" + formatReq;
}
// 追问轮：带上上一轮纪要 + 定向问题
const q = (analysis.followUps && analysis.followUps[agent.id]) || "请更新你的整体判断。";
let recap = "「上一轮纪要」\n";
analysis.common.slice(0, 5).forEach((c, i) => { recap += "共识" + (i + 1) + "：" + short(c.rep, 60) + "\n";});
analysis.unique.slice(0, 5).forEach(u => {
recap += "待深挖（" + u.points[0].agentName + "）： " + short(u.rep, 60) + "\n";
});
return roleLine + "\n" + briefBlock(debate) + recap +
"「本轮追问」" + q + "\n最后请用 3 行总结：坚持的结论 / 修正的观点 / 仍不确定的风险。";
}
function short(s, n) {
s = String(s).replace(/\s+/g, " ").trim();
return s.length > n? s.slice(0, n) + "…": s;
}

/* ---------------- 启发式差异分析（本地） ---------------- */
function splitPoints(text) {
return String(text || "")
.split(/\r?\n|[。！？；]/)
.map(s => s.replace(/^[\s*\->•\d.、()（）\[\]]+/, "").replace(/\*\*/g, "").trim())
.filter(s => s.length >= 8 && s.length <= 200);
}
function bigrams(s) {
const set = new Set();
const chars = Array.from(s);
if (chars.length < 4) { chars.forEach(c => set.add(c)); return set;}
for (let i = 0; i < chars.length - 1; i++) set.add(chars[i] + chars[i + 1]);
return set;
}
function similarity(a, b) {
const A = bigrams(a), B = bigrams(b);
if (!A.size ||!B.size) return 0;
let inter = 0;
for (const x of A) if (B.has(x)) inter++;
return inter / (A.size + B.size - inter);
}
function analyzeRound(debate, round) {
const points = [];
for (const aid of debate.agentIds) {
const agent = NS.Agents.getAgent(aid);
const ans = (round.answers[aid] || "").trim();
if (!ans) continue;
for (const p of splitPoints(ans)) {
points.push({ agentId: aid, agentName: agent? agent.name: aid, text: p});
}
}
const clusters = [];
for (const p of points) {
let best = null, bestSim = 0;
for (const c of clusters) {
const sim = similarity(p.text, c.rep);
if (sim > bestSim) { bestSim = sim; best = c;}
}
if (best && bestSim >= 0.3) best.points.push(p);
else clusters.push({ rep: p.text, points: [p]});
}
const nAgents = debate.agentIds.length;
const commonThreshold = Math.max(2, Math.ceil(nAgents * 0.6));
const common = [], unique = [];
for (const c of clusters) {
const agents = new Set(c.points.map(p => p.agentId));
c.agentCount = agents.size;
if (agents.size >= commonThreshold) common.push(c);
else if (agents.size === 1) unique.push(c);
}
common.sort((a, b) => b.points.length - a.points.length);
const coverage = {};
for (const aid of debate.agentIds) {
coverage[aid] = clusters.filter(c => c.points.some(p => p.agentId === aid)).length;
}
const analysis = {
at: NS.Core.nowISO(),
totalPoints: points.length,
clusters: clusters.length,
common, unique,
partial: clusters.filter(c => {
const n = new Set(c.points.map(p => p.agentId)).size;
return n > 1 && n < commonThreshold;
}),
coverage,
followUps: buildFollowUps(debate, { common, unique}),
note: "启发式本地分析：按语义相似度聚类观点，仅供辅助判断，最终结论由人工确认。",
};
return analysis;
}
function buildFollowUps(debate, { common, unique }) {
  // 独特观点按来源 Agent 分组，再轮询取用：保证每家的独特观点都被追问到
  const bySrc = {};
  unique.slice(0, 12).forEach(u => {
    const sid = u.points[0].agentId;
    (bySrc[sid] = bySrc[sid] || []).push(u);
  });
  const srcIds = Object.keys(bySrc);
  function uniqQsFor(aid) {
    const qs = [];
    let round = 0;
    while (qs.length < 3 && round < 12) {
      let added = false;
      for (const sid of srcIds) {
        if (sid === aid || qs.length >= 3) continue;
        const u = (bySrc[sid] || [])[round];
        if (!u) continue;
        const from = u.points[0];
        qs.push("「" + from.agentName + "」提出：「" + short(u.rep, 70) +
          "」，其他成员尚未充分讨论。请从你的专业视角补充、质疑或完善这一观点，并说明它对议题的实质影响。");
        added = true;
      }
      if (!added) break;
      round++;
    }
    return qs;
  }
  // 共识 → 要落地步骤
  const commonQs = common.slice(0, 3).map(c =>
    "各方一致认同：「" + short(c.rep, 70) + "」。请基于你的专业，给出 3 条具体落地步骤或可量化指标。");
  const res = {};
  for (const aid of debate.agentIds) {
    const qs = uniqQsFor(aid);
    // 追问位不足时用共识落地题补齐到 3 个
    for (const cq of commonQs) { if (qs.length < 3) qs.push(cq); }
    qs.push("综合本轮追问，更新你对议题的整体判断。");
    res[aid] = qs.join("\n");
  }
  return res;
}

/* ---------------- 共识报告 ---------------- */
function buildReport(debate) {
const L = [];
const agents = debate.agentIds.map(id => NS.Agents.getAgent(id)).filter(Boolean);
L.push("# 决策共识报告：" + debate.topic);
L.push("");
L.push("- 生成时间：" + NS.Core.fmtTime(NS.Core.nowISO()));
L.push("- 讨论轮次：" + debate.rounds.length);
L.push("- 参与 Agent：" + agents.map(a => a.name + "（" + a.role + "）").join("、"));
L.push("");
const last = debate.rounds[debate.rounds.length - 1];
const analysis = last && last.analysis;
L.push("## 一、共识结论");
if (analysis && analysis.common.length) {
analysis.common.forEach((c, i) => {
L.push((i + 1) + ". " + c.rep + "（" + c.agentCount + "/" + debate.agentIds.length + " 方认同）");
});
} else L.push("（本轮未形成明确共识，建议继续追问或人工裁定）");
L.push("");
L.push("## 二、主要分歧与盲区");
if (analysis && analysis.unique.length) {
analysis.unique.slice(0, 10).forEach(u => {
L.push("- " + u.rep);
});
} else L.push("（无）");
L.push("");
L.push("## 三、待决策事项");
if (analysis && analysis.unique.length) {
analysis.unique.slice(0, 8).forEach((u, i) => {
L.push((i + 1) + ". 是否采纳「" + short(u.rep, 50) + "」（提出方：" + u.points[0].agentName + "）");
});
} else L.push("（无）");
L.push("");
L.push("## 四、行动建议");
if (analysis && analysis.common.length) {
analysis.common.slice(0, 5).forEach((c, i) => {
L.push((i + 1) + ". 围绕「" + short(c.rep, 50) + "」制定可量化的执行计划，明确负责人与时间节点。");
});
} else L.push("1. 先就分歧点组织专项讨论，再形成执行计划。");
L.push("");
L.push("## 附：分析说明");
L.push("- 差异分析为本地启发式聚类（语义相似度），辅助人工判断，不替代人工决策。");
L.push("- 原始问答已保存在议题详情中，可随时回看。");
L.push("");
return L.join("\n");
}

/* ---------------- 知识库 ---------------- */
function listKnowledge() { return NS.Core.Store.load().knowledge;}
function saveKnowledge(entry) {
const s = NS.Core.Store.load();
entry.id = entry.id || NS.Core.uid("kb");
entry.createdAt = entry.createdAt || NS.Core.nowISO();
const i = s.knowledge.findIndex(k => k.id === entry.id);
if (i >= 0) s.knowledge[i] = entry; else s.knowledge.unshift(entry);
NS.Core.Store.save();
return entry;
}
function deleteKnowledge(id) {
const s = NS.Core.Store.load();
s.knowledge = s.knowledge.filter(k => k.id!== id);
NS.Core.Store.save();
}

NS.Debate = {
listDebates, getDebate, saveDebate, deleteDebate, createDebate, newRound,
roundComplete, buildQuestion, splitPoints, similarity, analyzeRound,
buildFollowUps, buildReport, short,
listKnowledge, saveKnowledge, deleteKnowledge,
};

if (typeof module!== "undefined") module.exports = NS.Debate;
})();
