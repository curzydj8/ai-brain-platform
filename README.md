# AI Brain Platform · 企业级多智能体协商决策平台

零 API Key 起步的多 AI 协商决策平台：编排 ChatGPT / Gemini / Copilot / Grok / Muse
网页版共同讨论、交叉验证、形成共识。后期可接入 API（BYOK），可扩展为企业级 AI 决策系统。

- 在线体验：https://curzydj8.github.io/ai-brain-platform/
- 企划书：[docs/vision.md](docs/vision.md)

## 第一阶段（当前）：纯静态 Web

- 无构建、无后端、无 API Key，打开即用
- 数据只存本机浏览器 localStorage（`aibrain.v1`），支持导出/导入 JSON
- 工作流：平台生成提问 → 人工复制到各 AI 网页提问 → 粘贴回答回来 →
  本地差异分析 → 定向追问（最多 5 轮）→ 共识报告（Markdown）

## 本地运行

```bash
cd web && python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 测试

```bash
node test/debate.test.js   # 辩论引擎回归（Node）
node test/browser.test.js  # 浏览器分支模拟（vm 沙盒）
```

## 目录

```
web/            静态站点（部署到 gh-pages 根目录）
  index.html
  css/style.css
  js/           core.js / agents.js / debate.js / ui.js / app.js
docs/vision.md  项目企划书
test/           回归测试
```

## 路线图

- 第二阶段：Node.js + Express + PostgreSQL/Supabase 后端，BYOK 接入各模型 API 自动调用
- 第三阶段：自动建 GitHub Issue、生成代码、提 PR、自动测试（AI 软件开发团队）
- 第四阶段：物流行业 Agent（物流/海关/运价/仓储/客服/财务/风控）
