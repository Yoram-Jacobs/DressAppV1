# Gemma 4 E4B / E2B — Agent 认知体系与推理指南

**目标受众：** 负责 DressApp Eyes 视觉与造型流水线的未来 AI 智能体、维护人员及算法工程师。  
**日期：** 2026年9月  
**状态：** 生产环境在线 (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

本文档记录 DressApp 体系中定制微调的 `gemma-4-E4B-it` 模型架构规格、推断规则与生产路由逻辑。

---

## 1. 核心架构事实
- **模型特征：** Google Gemma-4-E4B 是有效参数为 40 亿（总计约 45 亿）的多模态图文语言模型，采用逐层嵌入（PLE）技术。生产环境量化为 `Q3_K_M`（磁盘占用约 2.7 GB，常驻内存约 2.85 GB），可在无显卡的 Hetzner CPX32 VPS（4 核 AMD vCPU）纯 CPU 环境下高效运行。
- **上下文窗口：** 最高支持 128K tokens（在 `dressapp-eyes` 容器中固定分配 4,096 tokens 以保证极致低延迟与内存安全）。
- **多模态输入：** 通过 `mmproj-BF16.gguf` 原生支持图片、音频与文本联合输入。
- **生产服务架构：** 在 `dressapp-eyes` 容器内部的 7860 端口运行 `llama-server`，外层由 FastAPI 鉴权保护（`EYES_API_TOKEN`）。

## 2. 生产角色与多层级智能路由
1. **免费用户核心引擎**：为免费版用户及未配置私有 API 密钥的用户提供交互式穿搭问答与衣物属性智能提取。
2. **后台定时任务（Cron）**：无需产生商业云端 API 账单即可每日自动执行衣橱索引重塑与早间穿搭推荐。
3. **配额耗尽智能兜底（Quota Fallback）**：自动捕获第三方供应商（Google Gemini）的超额报错（`429`）与 `RESOURCE_EXHAUSTED`，平滑将请求切换至本地 Gemma 模型，绝不向用户抛出异常或中断会话。
4. **权限分界线**：高消耗的云端生成式能力（Trend Scout 资讯雷达与 Nano Banana 图像修补）严格要求用户提供个人密钥。
