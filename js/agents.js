/* AI Brain Platform · agents.js
 * 5 个默认 Agent（角色/网址/启用态均可改）。Transport 抽象：
 * ManualTransport（本阶段：人工中转）/ ApiTransport（第二阶段 BYOK）/ ExtensionTransport（预留）。
 */
(() => {
"use strict";

const NS = (window.AIBrain = window.AIBrain || {});

const DEFAULT_AGENTS = [
  {
    id: "agent_chatgpt", name: "ChatGPT", role: "首席架构师",
    strengths: ["系统规划", "架构设计", "数据结构", "流程设计"],
    url: "https://chatgpt.com", color: "#10a37f",
    note: "适合：把议题拆成系统、模块与可执行方案。",
    enabled: true,
  },
  {
    id: "agent_gemini", name: "Gemini", role: "首席研究员",
    strengths: ["信息检索", "知识整合", "行业研究", "法规政策"],
    url: "https://gemini.google.com", color: "#1a73e8",
    note: "适合：补充事实、数据、竞品与政策依据。",
    enabled: true,
  },
  {
    id: "agent_copilot", name: "Copilot", role: "首席开发工程师",
    strengths: ["代码生成", "Bug 修复", "自动重构", "自动测试"],
    url: "https://copilot.microsoft.com", color: "#7c3aed",
    note: "适合：技术可行性、实现路径与工程风险。",
    enabled: true,
  },
  {
    id: "agent_grok", name: "Grok", role: "创新顾问",
    strengths: ["创新思维", "商业分析", "用户增长", "新方向探索"],
    url: "https://grok.com", color: "#e5e7eb",
    note: "适合：跳出常规的打法、商业模式与增长点。",
    enabled: true,
  },
  {
    id: "agent_claude", name: "Muse", role: "任务执行官",
    strengths: ["任务执行", "远程操作", "流程调度", "历史记忆"],
    url: "https://claude.ai", color: "#d97757",
    note: "适合：把结论拆成任务清单与执行步骤。",
    enabled: true,
  },
];

function defaultState() {
  return {
    version: 1,
    agents: DEFAULT_AGENTS.map(a => Object.assign({}, a, { strengths: a.strengths.slice() })),
    debates: [],
    knowledge: [],
    settings: { maxRounds: 5, apiProvider: "none", apiKey: "" },
  };
}

function getAgents() { return NS.Core.Store.load().agents; }
function getAgent(id) { return getAgents().find(a => a.id === id); }
function enabledAgents() { return getAgents().filter(a => a.enabled); }
function saveAgents(agents) {
  const s = NS.Core.Store.load();
  s.agents = agents;
  NS.Core.Store.save();
}
function upsertAgent(agent) {
  const agents = getAgents();
  const i = agents.findIndex(a => a.id === agent.id);
  if (i >= 0) agents[i] = agent; else agents.push(agent);
  saveAgents(agents);
}

/* Transport：本阶段只有人工中转可用；API/插件为预留接口 */
const Transports = {
  manual: {
    id: "manual",
    name: "人工中转（当前）",
    available: true,
    hint: "平台生成提问 → 你复制到各 AI 网页提问 → 把回答粘贴回来。不需要任何 Key。",
  },
  api: {
    id: "api",
    name: "API 直连（第二阶段）",
    available: false,
    hint: "BYOK：填入你自己的 API Key 后自动调用。Key 只存本机，永不上传。",
  },
  extension: {
    id: "extension",
    name: "浏览器插件（预留）",
    available: false,
    hint: "未来通过浏览器插件半自动读写已登录的 AI 网页。",
  },
};

NS.Seed = { defaultState, DEFAULT_AGENTS };
NS.Agents = { getAgents, getAgent, enabledAgents, saveAgents, upsertAgent, Transports };

if (typeof module !== "undefined") module.exports = NS.Agents;
})();
