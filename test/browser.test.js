/* AI Brain Platform · 浏览器分支模拟（vm 沙盒：有 window，无 module/require） */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JSDIR = path.join(__dirname, "..", "web", "js");
function fakeEl() {
  return {
    innerHTML: "", textContent: "",
    classList: { add() {}, remove() {} },
    appendChild() {}, remove() {}, click() {},
    addEventListener() {}, querySelector() { return null; },
  };
}
const sandbox = {
  window: {},
  console,
  location: { hash: "#/dashboard" },
  navigator: {},
  setTimeout: (fn) => 0, clearTimeout: () => {},
  document: {
    readyState: "complete",
    getElementById: () => fakeEl(),
    createElement: () => fakeEl(),
    addEventListener() {},
    body: fakeEl(),
  },
  URLSearchParams,
};
sandbox.window.scrollTo = () => {};
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

const files = ["core.js", "agents.js", "debate.js", "ui.js", "app.js"];
for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(path.join(JSDIR, f), "utf8"), sandbox, { filename: f });
    console.log(f, "browser eval OK");
  } catch (e) {
    console.error(f, "BROWSER EVAL FAIL:", e.message);
    process.exit(1);
  }
}
const NS = sandbox.window.AIBrain;
const checks = [
  ["AIBrain.Core", NS.Core],
  ["AIBrain.Agents", NS.Agents],
  ["AIBrain.Debate", NS.Debate],
  ["AIBrain.UI", NS.UI],
];
let fail = 0;
for (const [name, v] of checks) {
  if (v) console.log(name, "exported"); else { console.log(name, "MISSING"); fail++; }
}
// 在沙盒里走一遍真实流程（无 localStorage → 走内存态）
const src = `
(() => {
  const AIBrain = window.AIBrain;
  const d = AIBrain.Debate.createDebate({ topic: "沙盒测试议题", background: "bg", constraints: "" });
  for (const aid of d.agentIds) d.rounds[0].answers[aid] = "核心判断：同意微服务架构。关键论据：扩展性好。风险提示：成本。行动建议：试点。";
  d.rounds[0].analysis = AIBrain.Debate.analyzeRound(d, d.rounds[0]);
  d.report = AIBrain.Debate.buildReport(d);
  return "rounds=" + d.rounds.length + " common=" + d.rounds[0].analysis.common.length + " reportLen=" + d.report.length;
})()
`;
try {
  console.log("sandbox flow:", vm.runInContext(src, sandbox));
} catch (e) { console.error("sandbox flow FAIL:", e.message); fail++; }
console.log(fail ? "BROWSER TEST FAILED" : "BROWSER TEST OK");
process.exit(fail ? 1 : 0);
