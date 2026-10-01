/* AI Brain Platform · core.js
 * 命名空间 / 工具函数 / 本地持久化。零后端、零 API Key，全部状态存 localStorage。
 */
(() => {
"use strict";

const NS = (window.AIBrain = window.AIBrain || {});
const LS_KEY = "aibrain.v1";

function uid(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function nowISO() { return new Date().toISOString(); }
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch (e) { return iso; }
}
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/* 外链清洗：只允许 http(s)，其余一律补 https，防 javascript: 伪协议 */
function safeUrl(u) {
  u = String(u || "").trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u) return "https://" + u;
  return "#";
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_e) {}
    ta.remove();
    return ok;
  }
}

/* ---------------- 本地 Store ---------------- */
const Store = {
  state: null,
  load() {
    if (this.state) return this.state;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { this.state = JSON.parse(raw); return this.state; }
    } catch (e) {}
    this.state = NS.Seed.defaultState();
    this.save();
    return this.state;
  },
  save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); }
    catch (e) { /* 配额不足等：保持内存态 */ }
  },
  reset() {
    this.state = NS.Seed.defaultState();
    this.save();
  },
  exportJSON() { return JSON.stringify(this.state, null, 2); },
  importJSON(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.agents) || !Array.isArray(data.debates)) {
      throw new Error("文件格式不正确：缺少 agents / debates");
    }
    this.state = Object.assign(NS.Seed.defaultState(), data);
    this.save();
  },
};

NS.Core = { uid, esc, nowISO, fmtTime, download, copyText, safeUrl, Store, LS_KEY };

if (typeof module !== "undefined") module.exports = NS.Core;
})();
