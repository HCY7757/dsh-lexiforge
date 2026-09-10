# dsh-LexiForge · DSH 语言模组框架

> **LexiForge** — a pluggable **language-module (LangPack) framework** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). It intercepts the model's reply stream and re-processes it through installable, ZIP-based language packs: style rewriting, terminology-aware retrieval, local rule post-processing, or a composed pipeline of all three. **面向 DeepSeek Harness 的社区语言模组插件：配置驱动、安全优先、按需计算、零运维。**

---

## ✨ 特性一览 / Features

| | |
|---|---|
| 🧩 语言包即配置 | ZIP 承载、零可执行代码、格式白名单（`.yaml/.yml/.json/.db/.txt`），Zip Slip / 炸弹防护 |
| A/B/C 三模式引擎 | **A** LLM 整段改写（独立请求，不占主上下文）· **B** SQLite FTS5 术语库检索增强 · **C** 纯本地规则替换（零 token） |
| 🧬 复合模式 | 单包内 `pipeline: [B, A, C]` 编排：检索注入 → 一次改写 → 规则收尾，**全程只一次 LLM 请求** |
| 🔗 链式多包 | 多个包按优先级依次加工同一回复（如 校对 → 文言 → 口头禅收尾） |
| 🛡️ 安全 | 解压校验（穿越/重复/链接/加密/条目/大小）、manifest/dict/knowledge 结构校验、worker 线程隔离查询、超时回退原文、独立请求防递归 |
| 🎨 原生 UI | 融入 DSH 设置页（`settings.section`）：启停、拖拽排序、GitHub 市场、手动安装、超时(0.1–600s)、调试日志开关（相对路径） |
| 🌐 市场分发 | 纯 GitHub 驱动：`topic:dsh-langpack` 搜索；单包仓库（根 `langpack.zip`）与 **多合一仓库**（`langpacks.json` 索引，逐包识别安装）双支持 |
| 🧪 可观测 | 可选运行日志（开关在设置页），记录拦截/跳过原因与每段改写结果 |

---

## 📦 演示语言包 / Demo packs

`examples/` 下五个官方示例（源码 + zip），并单独发布多合一示例仓库：

| 包 | 模式 | 效果 |
|---|---|---|
| `demo-a-wenyan` | A | 白话 → 文言文风格 |
| `demo-b-gufeng` | B | 古风称谓术语（RAG） |
| `demo-b-huoxing` | composite B→A→C | 重度火星文（字形检索 + 六技法改写 + 混排保险层） |
| `demo-a-rikka` | A | 中二病·小鸟游六花 语气模仿 |
| `demo-a-proofread` | A | 输出复查·纠错（无错逐字原样） |

> 多合一语言包发布示例：**[dsh-langpack-demo](https://github.com/HCY7757/dsh-langpack-demo)** —— 一个仓库包含 4 个可分别安装的语言包（含 `langpacks.json` 索引）。

---

## 🚀 安装 / Install

### 前置条件
- DeepSeek Harness（web profile）已就绪
- Node.js ≥ 22（构建用）、pnpm

### 加载插件（本地开发）
```powershell
# 1. 把插件加入 web profile（~/.dsh/profiles/web/package.json）
#    "dsh-lexiforge": "file:F:/dev/dsh-LexiForge"   ← 替换为你的本地路径
#    并在 dsh.profile.bundles 增加 "dsh-lexiforge"

# 2. 安装依赖并构建
pnpm install
pnpm build          # tsc + esbuild 客户端打包（scripts/build-client.mjs）

# 3. 在 profile 的 cordis.patch.yml 注入配置（entry id 必须为 dsh-LexiForge）
# - id: dsh-LexiForge
#   config:
#     packagesDir: F:/dev/lexiforge-demo   # 数据目录（D/F 盘，绝对路径）
#     enabled: true
#     # debugLog: debug.log                # 可选：日志位置（相对 packagesDir）

# 4. 重启 dsh web → 设置页出现「语言模组」
```

> 插件包须同时声明 `dsh.bundle.patch`（cordis.patch.yml，`insert` 挂载）与 `dsh.client`（浏览器端 UI）；`exports` 必须包含 `"./package.json"`，客户端 bundle 需按 `__ModuleLoader__.load` 的 CJS 工厂契约构建（见 `scripts/build-client.mjs`）。修改源码后需删除 profile `node_modules` 中的拷贝再 `pnpm install`，host 代码改动需重启 dsh。

### CLI（语言包管理）
```powershell
# 构建后生成可执行入口
pnpm build
node dist/cli.js --help

lexiforge <数据目录> disclaimer                                    # 阅读第三方免责声明
lexiforge <数据目录> install 包.zip 包ID --accept-risk             # 本地 zip 安装
lexiforge <数据目录> market-install owner/repo 包ID --accept-risk  # 从 GitHub 安装（合集仓需包ID）
lexiforge <数据目录> search 关键词                                 # 搜索 topic:dsh-langpack
lexiforge <数据目录> enable 包ID | disable 包ID | on | off | order ID...
lexiforge <数据目录> uninstall 包ID
lexiforge knowledge 词条.csv 输出.db                               # 生成 B 模式知识库（FTS5 trigram）
```

---

## 📖 语言包规范 / LangPack spec

ZIP 内仅允许四类文件（根目录平铺）：`manifest.yaml`（必填）、`dict.json`、`knowledge.db`、`说明.txt`。

```yaml
# manifest.yaml
name: 我的语言包        # 必填
version: 1.0.0          # 必填（semver）
author: 某人            # 必填
mode: composite         # A | B | C | composite
pipeline: [B, A, C]     # composite 必填：至少含 A 或 C；B 的检索结果注入其后的 A
prompt_template: |      # 含 A 时必填；{{text}}=原文，{{knowledge}}=B 检索结果
  ...
dict_path: dict.json        # 含 C 时必填：replacements 字面量替换 + rules 正则
knowledge_db: knowledge.db  # 含 B 时必填：由 `lexiforge knowledge` 生成
```

- **A**：一次独立 LLM 请求整段改写（不带历史/工具，防递归）
- **B**：先用回复文本检索 `knowledge.db`（FTS5 trigram），Top-N 注入 A 的 prompt
- **C**：worker 线程执行字典与正则，零 token；可作“保险层”强制收尾
- 多包可链式叠加；顺序在 UI 拖拽或 CLI `order` 调整；每个包可设置全局处理超时（默认 0.5s，UI 可调 0.1–600s，超时自动回退原文）

详细示例与多合一发布模板见 [dsh-langpack-demo](https://github.com/HCY7757/dsh-langpack-demo)。

---

## 🔒 安全设计 / Security

- 解压：扩展名白名单、路径穿越/重复/链接/加密拒绝、64MB & 1024 条目上限、实际字节复核
- 校验：manifest 字段白名单 + semver；dict 规模/正则合法性；knowledge.db 只读打开（`trusted_schema OFF`），查询运行于可终止的 worker
- 流处理：完整缓冲、超时回退原文、改写请求剥离 session/历史/tools、`independentRequests` 防递归
- 安装门：首次使用强制《第三方免责声明》闸门；接受记录仅存本机 `state.json`
- 边界：所有防护为“格式层”，不构成内容安全担保；第三方包可能包含恶意提示词/词条，请按免责声明自查

---

## 🧑‍💻 开发 / Development

```powershell
pnpm install
pnpm build     # tsc + client bundle (esbuild)
pnpm test      # node --test（11 项：安装/恶意包/检索/复合/免责声明/流拦截…）
```

目录结构：`src/services`（package-manager / processor / knowledge / market / stream-interceptor / manifest）、`src/utils/unpacker.ts`（安全解压）、`src/client`（设置页 UI）、`src/disclaimer.ts`（免责声明权威文本）、`scripts/build-client.mjs`（客户端 bundle 契约构建）、`tests`。

---

## ⚖️ 免责 / Disclaimer

本插件只提供语言包的发现、下载与安装能力。语言包由第三方作者制作，插件作者不承担内容审核、质量保证与法律责任。请阅读插件内《第三方语言包免责声明》后自行评估风险。演示包均为学习示例，不构成任何担保。

## 📄 License

MIT — 详见 [LICENSE](LICENSE)。
