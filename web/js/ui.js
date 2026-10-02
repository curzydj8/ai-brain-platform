/* AI Brain Platform · ui.js — 视图渲染 + 交互（哈希路由） */
(() => {
"use strict";

const NS = (window.AIBrain = window.AIBrain || {});
const { esc, fmtTime, copyText, download } = NS.Core;

const app = document.getElementById("app");

/* ---------------- 布局 ---------------- */
function layout(active, content, wide) {
  const nav = [
    ["dashboard", "控制台", "#/dashboard"],
    ["debates", "议题", "#/debates"],
    ["agents", "Agent 中心", "#/agents"],
    ["knowledge", "知识库", "#/knowledge"],
    ["settings", "设置", "#/settings"],
  ];
  return `
  <div class="shell">
    <aside class="side">
      <div class="brand"><div class="brand-mark">🧠</div><div><div class="brand-name">AI Brain</div><div class="brand-sub">多智能体协商决策平台</div></div></div>
      <nav>${nav.map(([k, t, h]) => `<a href="${h}" class="nav-item${active === k ? " on" : ""}">${t}</a>`).join("")}</nav>
      <div class="side-foot">零 API Key 起步 · 数据只存本机</div>
    </aside>
    <main class="main${wide ? " wide" : ""}">${content}</main>
  </div>`;
}
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1800);
}
function md(src) {
  return esc(src).split("\n").map(line => {
    if (/^####\s/.test(line)) return "<h4>" + line.slice(5) + "</h4>";
    if (/^###\s/.test(line)) return "<h3>" + line.slice(4) + "</h3>";
    if (/^##\s/.test(line)) return "<h2>" + line.slice(3) + "</h2>";
    if (/^#\s/.test(line)) return "<h1>" + line.slice(2) + "</h1>";
    if (/^[-*]\s/.test(line)) return "<li>" + line.slice(2).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</li>";
    if (/^\d+\.\s/.test(line)) return "<li class='ol'>" + line.replace(/^\d+\.\s/, "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</li>";
    if (!line.trim()) return "";
    return "<p>" + line.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</p>";
  }).join("\n").replace(/(<li>.*<\/li>\n?)+/g, m => "<ul>" + m + "</ul>");
}

/* ---------------- 控制台 ---------------- */
function vDashboard() {
  const s = NS.Core.Store.load();
  const debates = s.debates, kb = s.knowledge;
  const rounds = debates.reduce((n, d) => n + d.rounds.length, 0);
  const cards = [
    ["议题", debates.length], ["讨论轮次", rounds],
    ["知识条目", kb.length], ["Agent", NS.Agents.enabledAgents().length + " / " + s.agents.length],
  ];
  const recent = debates.slice(0, 5).map(d => `
    <a class="row-card" href="#/debate/${d.id}">
      <div class="row-title">${esc(d.topic)}</div>
      <div class="row-meta">${d.rounds.length} 轮 · ${fmtTime(d.createdAt)} · ${d.status === "done" ? "已出共识" : "进行中"}</div>
    </a>`).join("") || `<div class="empty">还没有议题，先创建一个。</div>`;
  return layout("dashboard", `
    <h1>控制台</h1>
    <div class="how">
      <b>工作原理（零 API Key）：</b>
      ① 平台按 Agent 角色生成提问 → ② 你 <b>复制</b> 到 ChatGPT / Gemini / Copilot / Grok / Muse 网页提问 →
      ③ 把回答 <b>粘贴</b> 回来 → ④ 平台做差异分析、生成追问 → ⑤ 形成共识报告。全程不需要任何 Key。
    </div>
    <div class="stat-grid">${cards.map(([k, v]) => `<div class="stat"><div class="stat-v">${v}</div><div class="stat-k">${k}</div></div>`).join("")}</div>
    <div class="sec-head"><h2>最近议题</h2><a class="btn" href="#/debates">全部议题</a></div>
    ${recent}
    <div style="margin-top:16px"><a class="btn primary" href="#/debates?action=new">＋ 发起新议题</a></div>
  `);
}

/* ---------------- 议题列表 / 新建 ---------------- */
function vDebates(isNew) {
  const debates = NS.Debate.listDebates();
  const form = isNew ? `
    <form id="new-debate" class="card form">
      <h2>发起新议题</h2>
      <label>议题 <input name="topic" required maxlength="120" placeholder="例如：设计企业级国际物流 AI 平台"></label>
      <label>背景 <textarea name="background" rows="3" placeholder="补充业务背景、现状、目标（可选）"></textarea></label>
      <label>约束条件 <textarea name="constraints" rows="2" placeholder="预算、时间、技术栈、合规等（可选）"></textarea></label>
      <div class="form-note">将按当前启用的 ${NS.Agents.enabledAgents().length} 个 Agent 生成首轮提问（最多 5 轮）。</div>
      <button class="btn primary" type="submit">创建并进入讨论</button>
    </form>` : `<div style="margin-bottom:12px"><a class="btn primary" href="#/debates?action=new">＋ 发起新议题</a></div>`;
  const list = debates.map(d => `
    <div class="row-card">
      <a href="#/debate/${d.id}"><div class="row-title">${esc(d.topic)}</div></a>
      <div class="row-meta">${d.rounds.length} 轮 · ${fmtTime(d.createdAt)} · ${d.status === "done" ? "已出共识" : "进行中"}</div>
      <div class="row-ops"><a href="#/debate/${d.id}">进入</a> · <a href="#" data-action="del-debate" data-id="${d.id}">删除</a></div>
    </div>`).join("") || `<div class="empty">还没有议题。</div>`;
  return layout("debates", `<h1>议题</h1>${form}${list}`);
}

/* ---------------- 议题详情（讨论室） ---------------- */
function vDebate(id) {
  const d = NS.Debate.getDebate(id);
  if (!d) return layout("debates", `<h1>议题不存在</h1><a class="btn" href="#/debates">返回</a>`);
  const roundsHtml = d.rounds.map(r => roundHtml(d, r)).join("");
  const last = d.rounds[d.rounds.length - 1];
  const canAnalyze = last && !last.analysis && NS.Debate.roundComplete(d, last);
  const maxRounds = NS.Core.Store.load().settings.maxRounds || 5;
  const canNext = last && last.analysis && d.rounds.length < maxRounds && d.status !== "done";
  const filled = last ? d.agentIds.filter(aid => (last.answers[aid] || "").trim()).length : 0;
  const reportHtml = d.report ? `
    <div class="card"><div class="sec-head"><h2>共识报告</h2>
      <div><button class="btn" data-action="copy" data-copy="${esc(d.report).replace(/"/g, "&quot;")}">复制</button>
      <button class="btn" data-action="download-report" data-id="${d.id}">下载 Markdown</button>
      <button class="btn" data-action="save-report-kb" data-id="${d.id}">存入知识库</button></div></div>
      <div class="report">${md(d.report)}</div></div>` : "";
  return layout("debates", `
    <div class="crumb"><a href="#/debates">议题</a> / ${esc(d.topic)}</div>
    <h1>${esc(d.topic)}</h1>
    ${d.background ? `<p class="muted">背景：${esc(d.background)}</p>` : ""}
    ${d.constraints ? `<p class="muted">约束：${esc(d.constraints)}</p>` : ""}
    <div class="toolbar">
      ${canAnalyze ? `<button class="btn primary" data-action="analyze" data-id="${d.id}">运行差异分析</button>` : ""}
      ${last && last.analysis ? `<button class="btn" data-action="analyze" data-id="${d.id}">重新运行差异分析</button>` : ""}
      ${canNext ? `<button class="btn" data-action="next-round" data-id="${d.id}">生成下一轮追问（${d.rounds.length + 1}/${maxRounds}）</button>` : ""}
      ${!d.report && last && last.analysis ? `<button class="btn primary" data-action="report" data-id="${d.id}">生成共识报告</button>` : ""}
      ${last && !last.analysis ? `<span class="muted">本轮已填写 ${filled}/${d.agentIds.length}，填完即可运行差异分析（粘贴后自动保存）。</span>` : ""}
    </div>
    ${roundsHtml}${reportHtml}
  `, true);
}
function roundHtml(d, r) {
  const agentCards = d.agentIds.map(aid => {
    const a = NS.Agents.getAgent(aid);
    if (!a) return "";
    const ans = r.answers[aid] || "";
    return `
    <div class="agent-card" style="--ac:${a.color}">
      <div class="agent-head"><span class="dot"></span><b>${esc(a.name)}</b><span class="muted">${esc(a.role)}</span>
        <a class="btn xs" href="${esc(NS.Core.safeUrl(a.url))}" target="_blank" rel="noopener">去 ${esc(a.name)} 网页提问 ↗</a>
      </div>
      <div class="qbox"><div class="qbox-title">提问（复制到 ${esc(a.name)} 网页） <button class="btn xs" data-action="copy" data-q="q-${r.n}-${aid}">复制</button></div>
        <pre id="q-${r.n}-${aid}" class="qtext">${esc(r.questions[aid] || "")}</pre></div>
      <textarea class="answer" data-debate="${d.id}" data-round="${r.n}" data-agent="${aid}" rows="7" placeholder="把 ${esc(a.name)} 的回答粘贴到这里…">${esc(ans)}</textarea>
      <div class="agent-foot"><span class="muted">${ans.trim() ? "✓ 已填写" : "待填写"}</span>
        <button class="btn xs" data-action="save-answer" data-debate="${d.id}" data-round="${r.n}" data-agent="${aid}">保存回答</button></div>
    </div>`;
  }).join("");
  let analysisHtml = "";
  if (r.analysis) {
    const an = r.analysis;
    analysisHtml = `
    <div class="analysis">
      <h3>差异分析 <span class="badge">本地启发式</span></h3>
      <div class="muted">${esc(an.note)}（${an.totalPoints} 个观点 → ${an.clusters} 个聚类）</div>
      <h4>共识点（${an.common.length}）</h4>
      ${an.common.map((c, i) => `<div class="pt consensus"><b>${i + 1}.</b> ${esc(c.rep)} <span class="muted">（${c.agentCount}/${d.agentIds.length} 方）</span></div>`).join("") || `<div class="muted">暂无</div>`}
      <h4>独特观点 / 盲区（${an.unique.length}）</h4>
      ${an.unique.slice(0, 10).map(u => `<div class="pt unique"><span class="badge" style="background:${(NS.Agents.getAgent(u.points[0].agentId) || {}).color || "#666"}">${esc(u.points[0].agentName)}</span> ${esc(u.rep)}</div>`).join("") || `<div class="muted">暂无</div>`}
    </div>`;
  }
  return `<div class="card"><h2>第 ${r.n} 轮 <span class="muted">· ${d.agentIds.length} 个 Agent 并排</span></h2><div class="agent-grid">${agentCards}</div>${analysisHtml}</div>`;
}

/* ---------------- Agent 中心 ---------------- */
function vAgents(editId) {
  const agents = NS.Agents.getAgents();
  const cards = agents.map(a => `
    <div class="row-card agent-row" style="--ac:${a.color}">
      <div><span class="dot"></span><b>${esc(a.name)}</b> <span class="muted">${esc(a.role)}</span>
        <span class="badge ${a.enabled ? "on" : ""}">${a.enabled ? "启用" : "停用"}</span></div>
      <div class="muted">专长：${esc(a.strengths.join("、"))}</div>
      <div class="muted"><a href="${esc(NS.Core.safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.url)}</a></div>
      <div class="row-ops"><a href="#/agents?edit=${a.id}">编辑</a> · <a href="#" data-action="toggle-agent" data-id="${a.id}">${a.enabled ? "停用" : "启用"}</a></div>
    </div>`).join("");
  let editForm = "";
  if (editId) {
    const a = NS.Agents.getAgent(editId);
    if (a) editForm = `
    <form id="edit-agent" class="card form" data-id="${a.id}">
      <h2>编辑 ${esc(a.name)}</h2>
      <label>名称 <input name="name" value="${esc(a.name)}" required></label>
      <label>角色 <input name="role" value="${esc(a.role)}" required></label>
      <label>专长（顿号分隔） <input name="strengths" value="${esc(a.strengths.join("、"))}"></label>
      <label>网页地址 <input name="url" value="${esc(a.url)}" required></label>
      <label>备注 <input name="note" value="${esc(a.note || "")}"></label>
      <button class="btn primary" type="submit">保存</button> <a class="btn" href="#/agents">取消</a>
    </form>`;
  }
  return layout("agents", `<h1>Agent 中心</h1>
    <p class="muted">5 个默认 Agent 对应 5 个 AI 网页。角色、网址、启用态都可改；停用后不再参与新议题。</p>
    ${editForm}${cards}`);
}

/* ---------------- 知识库 ---------------- */
function vKnowledge(q) {
  const all = NS.Debate.listKnowledge();
  const kw = (q || "").trim().toLowerCase();
  const list = all.filter(k => !kw || (k.title + k.body).toLowerCase().includes(kw));
  const items = list.map(k => `
    <div class="row-card">
      <div class="row-title">${esc(k.title)} <span class="badge">${k.kind === "report" ? "共识报告" : "笔记"}</span></div>
      <div class="row-meta">${fmtTime(k.createdAt)}</div>
      <details><summary>展开</summary><div class="report">${md(k.body)}</div></details>
      <div class="row-ops"><a href="#" data-action="copy-text" data-copy="${esc(k.body).replace(/"/g, "&quot;")}">复制</a> · <a href="#" data-action="del-kb" data-id="${k.id}">删除</a></div>
    </div>`).join("") || `<div class="empty">知识库是空的。${kw ? "换个关键词试试。" : "从议题生成共识报告并存入，或手动记笔记。"}</div>`;
  return layout("knowledge", `<h1>知识库</h1>
    <form id="kb-search" class="inline-form"><input name="q" value="${esc(q || "")}" placeholder="搜索标题/正文…"><button class="btn" type="submit">搜索</button></form>
    <form id="kb-note" class="card form"><h2>记一条笔记</h2>
      <label>标题 <input name="title" required maxlength="80"></label>
      <label>内容 <textarea name="body" rows="4" required></textarea></label>
      <button class="btn primary" type="submit">保存</button></form>
    ${items}`);
}

/* ---------------- 设置 ---------------- */
function vSettings() {
  const s = NS.Core.Store.load();
  const t = NS.Agents.Transports;
  return layout("settings", `<h1>设置</h1>
    <div class="card"><h2>数据</h2>
      <button class="btn" data-action="export">导出全部数据 (JSON)</button>
      <label class="btn">导入 <input type="file" id="import-file" accept=".json" hidden></label>
      <button class="btn danger" data-action="wipe">清空所有数据</button>
      <div class="muted">数据只存在本机浏览器 localStorage。导出可做备份或迁移。</div></div>
    <div class="card"><h2>讨论</h2>
      <label>最大讨论轮数 <input id="max-rounds" type="number" min="2" max="8" value="${s.settings.maxRounds || 5}" style="width:80px"></label>
      <button class="btn" data-action="save-max-rounds">保存</button></div>
    <div class="card"><h2>AI 接入方式 <span class="badge">第二阶段</span></h2>
      ${Object.values(t).map(x => `
        <div class="row-card"><b>${x.name}</b> ${x.available ? '<span class="badge on">可用</span>' : '<span class="badge">未启用</span>'}
        <div class="muted">${x.hint}</div></div>`).join("")}
      <label>API Key（预留，BYOK） <input type="password" disabled placeholder="第二阶段启用 · 仅存本机"></label>
      <div class="muted">现在不需要填任何 Key。接入 API 时，Key 只保存在本机，永不上传、永不进仓库。</div></div>
  `);
}

/* ---------------- 路由 ---------------- */
function render() {
  const h = location.hash || "#/dashboard";
  const [, path, query] = h.match(/^#\/([^?]+)(\?.*)?$/) || [];
  const qs = new URLSearchParams(query || "");
  let html;
  if (path === "dashboard") html = vDashboard();
  else if (path === "debates") html = vDebates(qs.get("action") === "new");
  else if (path === "debate" || path.indexOf("debate/") === 0) {
    const id = qs.get("id") || (path.split("/")[1] || "");
    html = vDebate(id);
  }
  else if (path === "agents") html = vAgents(qs.get("edit"));
  else if (path === "knowledge") html = vKnowledge(qs.get("q"));
  else if (path === "settings") html = vSettings();
  else html = vDashboard();
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

/* ---------------- 事件 ---------------- */
function bindEvents() {
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const act = el.dataset.action;
    if (act === "copy" || act === "copy-text") {
      e.preventDefault();
      const text = el.dataset.q ? document.getElementById(el.dataset.q).textContent : el.dataset.copy;
      toast(await copyText(text) ? "已复制" : "复制失败，请手动选择复制");
    }
    else if (act === "save-answer") {
      const { debate: did, round: rn, agent: aid } = el.dataset;
      const d = NS.Debate.getDebate(did);
      const ta = document.querySelector(`textarea[data-debate="${did}"][data-round="${rn}"][data-agent="${aid}"]`);
      const r = d.rounds.find(x => x.n === +rn);
      r.answers[aid] = ta.value;
      NS.Debate.saveDebate(d);
      toast("回答已保存");
      render();
    }
    else if (act === "analyze") {
      const d = NS.Debate.getDebate(el.dataset.id);
      const last = d.rounds[d.rounds.length - 1];
      last.analysis = NS.Debate.analyzeRound(d, last);
      NS.Debate.saveDebate(d);
      toast("差异分析完成");
      render();
    }
    else if (act === "next-round") {
      const d = NS.Debate.getDebate(el.dataset.id);
      const last = d.rounds[d.rounds.length - 1];
      d.rounds.push(NS.Debate.newRound(d, d.rounds.length + 1, last.analysis));
      NS.Debate.saveDebate(d);
      toast("已生成第 " + d.rounds.length + " 轮追问");
      render();
    }
    else if (act === "report") {
      const d = NS.Debate.getDebate(el.dataset.id);
      d.report = NS.Debate.buildReport(d);
      d.status = "done";
      NS.Debate.saveDebate(d);
      toast("共识报告已生成");
      render();
    }
    else if (act === "save-report-kb") {
      const d = NS.Debate.getDebate(el.dataset.id);
      NS.Debate.saveKnowledge({ title: "共识报告：" + d.topic, kind: "report", body: d.report, debateId: d.id });
      toast("已存入知识库");
    }
    else if (act === "download-report") {
      const d = NS.Debate.getDebate(el.dataset.id);
      const safe = d.topic.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
      download("共识报告-" + safe + ".md", d.report, "text/markdown;charset=utf-8");
      toast("已下载");
    }
    else if (act === "del-debate") {
      e.preventDefault();
      if (confirm("确定删除这个议题吗？")) { NS.Debate.deleteDebate(el.dataset.id); render(); }
    }
    else if (act === "toggle-agent") {
      e.preventDefault();
      const a = NS.Agents.getAgent(el.dataset.id);
      a.enabled = !a.enabled;
      NS.Agents.upsertAgent(a);
      render();
    }
    else if (act === "del-kb") {
      e.preventDefault();
      if (confirm("确定删除这条知识吗？")) { NS.Debate.deleteKnowledge(el.dataset.id); render(); }
    }
    else if (act === "export") {
      download("aibrain-backup.json", NS.Core.Store.exportJSON(), "application/json");
    }
    else if (act === "wipe") {
      if (confirm("确定清空本机所有数据吗？不可恢复！")) { NS.Core.Store.reset(); render(); toast("已清空"); }
    }
    else if (act === "save-max-rounds") {
      const v = Math.max(2, Math.min(8, +document.getElementById("max-rounds").value || 5));
      const s = NS.Core.Store.load();
      s.settings.maxRounds = v;
      NS.Core.Store.save();
      toast("已保存");
    }
  });

  document.addEventListener("submit", e => {
    const f = e.target;
    if (f.id === "new-debate") {
      e.preventDefault();
      if (NS.Agents.enabledAgents().length < 2) {
        toast("至少启用 2 个 Agent 才能发起议题，请去 Agent 中心启用");
        return;
      }
      const fd = new FormData(f);
      const d = NS.Debate.createDebate({
        topic: fd.get("topic"), background: fd.get("background"), constraints: fd.get("constraints"),
      });
      location.hash = "#/debate/" + d.id;
    }
    else if (f.id === "edit-agent") {
      e.preventDefault();
      const fd = new FormData(f);
      const a = NS.Agents.getAgent(f.dataset.id);
      a.name = fd.get("name").trim();
      a.role = fd.get("role").trim();
      a.strengths = String(fd.get("strengths")).split(/[、,，]/).map(s => s.trim()).filter(Boolean);
      a.url = fd.get("url").trim();
      a.note = (fd.get("note") || "").trim();
      NS.Agents.upsertAgent(a);
      location.hash = "#/agents";
      render();
    }
    else if (f.id === "kb-note") {
      e.preventDefault();
      const fd = new FormData(f);
      NS.Debate.saveKnowledge({ title: fd.get("title").trim(), kind: "note", body: fd.get("body").trim() });
      toast("已保存");
      render();
    }
    else if (f.id === "kb-search") {
      e.preventDefault();
      location.hash = "#/knowledge?q=" + encodeURIComponent(new FormData(f).get("q"));
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "import-file") {
      const file = e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { NS.Core.Store.importJSON(rd.result); toast("导入成功"); render(); }
        catch (err) { toast("导入失败：" + err.message); }
      };
      rd.readAsText(file);
    }
  });

  window.addEventListener("hashchange", render);

  /* 回答框自动保存（防抖）：粘贴后不用点保存也不会丢 */
  let autoT = null;
  document.addEventListener("input", e => {
    const ta = e.target && e.target.closest ? e.target.closest("textarea.answer") : null;
    if (!ta) return;
    clearTimeout(autoT);
    autoT = setTimeout(() => {
      const d = NS.Debate.getDebate(ta.dataset.debate);
      if (!d) return;
      const r = d.rounds.find(x => x.n === +ta.dataset.round);
      if (!r) return;
      const hadAnalyzeBtn = !!document.querySelector('[data-action="analyze"]');
      r.answers[ta.dataset.agent] = ta.value;
      NS.Debate.saveDebate(d);
      const card = ta.closest(".agent-card");
      const label = card && card.querySelector(".agent-foot .muted");
      if (label) label.textContent = ta.value.trim() ? "✓ 已填写（已自动保存）" : "待填写";
      const isLast = d.rounds[d.rounds.length - 1].n === r.n;
      if (isLast && !r.analysis && !hadAnalyzeBtn && NS.Debate.roundComplete(d, r)) render();
    }, 600);
  });
}

NS.UI = { render, bindEvents, toast, md };

if (typeof module !== "undefined") module.exports = NS.UI;
})();
