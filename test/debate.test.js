/* AI Brain Platform · 辩论引擎回归测试（Node） */
global.window = {};
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
const Core = require("../web/js/core.js");
const Agents = require("../web/js/agents.js");
const Debate = require("../web/js/debate.js");

let pass = 0, fail = 0;
function eq(a, b, name) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) pass++;
  else { fail++; console.log("FAIL", name, "\n  got :", sa, "\n  want:", sb); }
}
function ok(cond, name) { eq(!!cond, true, name); }

// 1. splitPoints
const pts = Debate.splitPoints("第一点是关于架构的考虑。第二点是关于成本的分析！\n- 第三点是关于风险的很长很长的描述内容");
eq(pts.length, 3, "splitPoints 切出 3 个观点");

// 2. similarity
eq(Debate.similarity("采用微服务架构", "采用微服务架构"), 1, "相同文本相似度=1");
ok(Debate.similarity("采用微服务架构", "今天天气很好") < 0.2, "无关文本相似度低");

// 3. 创建议题
const d = Debate.createDebate({ topic: "设计企业级国际物流 AI 平台", background: "日均万单", constraints: "预算 200 万" });
eq(d.rounds.length, 1, "首轮已生成");
eq(Object.keys(d.rounds[0].questions).length, 5, "5 个 Agent 都有提问");
ok(d.rounds[0].questions.agent_chatgpt.includes("设计企业级国际物流 AI 平台"), "提问包含议题");
ok(d.rounds[0].questions.agent_chatgpt.includes("ChatGPT"), "提问包含 Agent 名");

// 4. 填写回答 → 差异分析
const COMMON = "建议采用微服务架构来拆分物流核心模块。";
const answers = {
  agent_chatgpt: `核心判断：${COMMON}关键论据：架构解耦便于扩展。风险提示：分布式事务复杂。行动建议：先拆订单模块。`,
  agent_gemini: `核心判断：${COMMON}关键论据：行业头部都在用微服务。风险提示：运维成本上升。行动建议：引入服务网格。`,
  agent_copilot: `核心判断：${COMMON}关键论据：CI_CD 流水线成熟。风险提示：本地调试困难。行动建议：统一脚手架。`,
  agent_grok: "核心判断：应该用 Serverless 快速验证创新业务。关键论据：冷启动成本低。风险提示：长尾延迟。行动建议：边缘计算试点。",
  agent_claude: "核心判断：先组建平台工程小组。关键论据：执行需要专职团队。风险提示：跨部门协作难。行动建议：双周迭代。",
};
const r1 = d.rounds[0];
for (const [aid, text] of Object.entries(answers)) r1.answers[aid] = text;
ok(Debate.roundComplete(d, r1), "5 个回答齐 → 本轮完成");
r1.analysis = Debate.analyzeRound(d, r1);
ok(r1.analysis.common.length >= 1, "识别出共识点（微服务架构）");
ok(r1.analysis.unique.length >= 1, "识别出独特观点（Serverless/团队）");
ok(r1.analysis.note.includes("启发式"), "分析标注为启发式");

// 5. 追问生成（每 Agent 最多 3 个定向追问 + 1 个综合）
const fu = Debate.buildFollowUps(d, r1.analysis);
eq(Object.keys(fu).length, 5, "5 个 Agent 都有追问");
ok(fu.agent_chatgpt.includes("Serverless") || fu.agent_chatgpt.includes("Grok"), "追问引用独特观点");
ok(Object.values(fu).every(q => q.includes("整体判断")), "追问都带综合题");

// 6. 第二轮
const r2 = Debate.newRound(d, 2, r1.analysis);
d.rounds.push(r2);
ok(r2.questions.agent_chatgpt.includes("上一轮纪要"), "追问轮带上轮纪要");
for (const aid of d.agentIds) r2.answers[aid] = "更新判断：坚持微服务架构，修正成本预期，不确定的风险是组织适配。";
r2.analysis = Debate.analyzeRound(d, r2);
ok(r2.analysis.common.length >= 1, "第二轮仍有共识");

// 7. 共识报告
const report = Debate.buildReport(d);
for (const h of ["共识结论", "分歧与盲区", "待决策事项", "行动建议"]) ok(report.includes(h), "报告含：" + h);
d.report = report; d.status = "done";
Debate.saveDebate(d);

// 8. 存入知识库
Debate.saveKnowledge({ title: "共识报告：设计企业级国际物流 AI 平台", kind: "report", body: report, debateId: d.id });
eq(Debate.listKnowledge().length, 1, "知识库 1 条");
ok(Debate.listKnowledge()[0].body.includes("共识结论"), "知识库内容完整");

// 9. Store 导出/导入
const dumped = Core.Store.exportJSON();
Core.Store.reset();
eq(Debate.listDebates().length, 0, "reset 后议题清空");
Core.Store.importJSON(dumped);
eq(Debate.listDebates().length, 1, "导入后议题恢复");
eq(Debate.listKnowledge().length, 1, "导入后知识恢复");

// 10. Agent 停用
const a = Agents.getAgent("agent_grok");
a.enabled = false; Agents.upsertAgent(a);
eq(Agents.enabledAgents().length, 4, "停用后 4 个启用");
const d2 = Debate.createDebate({ topic: "测试停用", background: "", constraints: "" });
eq(d2.agentIds.length, 4, "新议题只含启用的 Agent");
a.enabled = true; Agents.upsertAgent(a);

// 11. safeUrl
eq(Core.safeUrl("chatgpt.com"), "https://chatgpt.com", "裸域名补 https");
eq(Core.safeUrl("https://x.com"), "https://x.com", "https 保持");
eq(Core.safeUrl("javascript:alert(1)"), "https://javascript:alert(1)", "伪协议被中和");
eq(Core.safeUrl(""), "#", "空串回 #");

console.log(`debate engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
