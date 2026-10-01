/* AI Brain Platform · app.js — 启动 */
(() => {
"use strict";
const NS = (window.AIBrain = window.AIBrain || {});
function boot() {
  const need = ["AIBrain", "Core", "Agents", "Debate", "UI"];
  const missing = need.filter(k => k === "AIBrain" ? !window.AIBrain : !NS[k]);
  if (missing.length) {
    document.getElementById("app").innerHTML =
      '<div style="padding:40px;color:#f87171">⚠️ 游戏模块加载失败（' + missing.join(", ") +
      '），请刷新重试。</div>';
    return;
  }
  NS.Core.Store.load();
  NS.UI.bindEvents();
  NS.UI.render();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
if (typeof module !== "undefined") module.exports = { boot };
})();
