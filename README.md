# Interview OS

岗位驱动的个人 AI 面试训练 MVP。

当前主流程：

1. 上传 CV、项目资料和 `job.xlsx`
2. 从岗位库选择目标岗位
3. 完成中文介绍、英文介绍或 Miro 项目讲解录音
4. 保存本地录音记录
5. 调用 `/api/transcribe` 生成转写
6. 调用 `/api/analyze-answer` 生成 AI 评分、诊断、修改稿和下一步任务

用户不需要填写自评分、问题标签、训练状态或改进建议。旧记录中的 `review` 只作为兼容数据展示。

## 本地开发

```bash
npm install
npm run dev
```

Vite 开发服务器只运行前端。完整 API 联调请使用 Vercel 开发环境或线上部署。

## AI Provider

```dotenv
AI_PROVIDER=mock
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DOUBAO_API_KEY=
DOUBAO_ENDPOINT=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

- 默认使用 Mock，不需要 Key。
- DeepSeek 文本 Provider 已实现。
- 设置 `AI_PROVIDER=deepseek` 且提供 `DEEPSEEK_API_KEY` 时，`/api/analyze-answer` 和 `/api/generate-job-pack` 会走 DeepSeek OpenAI-compatible chat completion。
- Key 缺失、Key 错误、请求超时、HTTP 错误、输出非 JSON 或字段缺失时自动回退 `mock_fallback`。
- 豆包、OpenAI、Gemini 已预留；未启用时回退 Mock。
- Key 只从服务端环境变量读取，不进入前端 Bundle。

## ASR Provider

```dotenv
ASR_PROVIDER=mock
OPENAI_API_KEY=
DOUBAO_ASR_API_KEY=
VOLCENGINE_ASR_API_KEY=
XFYUN_ASR_API_KEY=
ALIYUN_ASR_API_KEY=
TENCENT_ASR_API_KEY=
```

- `/api/transcribe` 和 Mock ASR 已实现。
- OpenAI、豆包、火山、讯飞、阿里云、腾讯云 Provider 接口已预留。
- 当前真实音频仍保存在浏览器 IndexedDB，没有上传到 ASR 服务。
- 配置未实现的真实 Provider 或缺少 Key 时返回 `mock_fallback`，不会阻断训练。

## API

### `POST /api/transcribe`

接收训练记录、训练类型、音频 metadata 和目标岗位，返回统一转写结果。当前 Mock 用于验证状态链路。

### `POST /api/analyze-answer`

接收转写文本、岗位、训练类型、时长、CV 摘要和参考稿，返回：

- 总分和总结
- 优点与主要问题
- 岗位、结构、表达、时长、流畅度、背稿风险、具体性反馈
- 30 秒与 90 秒优化稿
- 下一步训练任务

该接口不接收或依赖用户自评。

### `POST /api/generate-job-pack`

根据 `selectedJob`、CV 文本、训练记录、AI 反馈和参考稿生成岗位准备包。输出包含：

- 公司业务总结
- 产品与业务方向
- 岗位要求拆解
- 日常工作预测
- 候选人匹配点和风险点
- 自我介绍策略
- Miro 项目讲法
- 高频面试问题
- 满分回答框架
- 面试前准备任务

准备包是学习资料和高概率方向，不是面试舱固定题库。

## 验证

```bash
npm run lint
npm run build
npm run test:ai
```

`test:ai` 覆盖文本 Mock、DeepSeek 缺 Key 回退、输入校验、Mock ASR 和 ASR 缺 Key 回退。

`npx playwright test` 覆盖岗位表上传、岗位解析、选岗持久化、录音保存、模拟转写、Mock AI 反馈、岗位准备包生成和 JSON 备份导出。

## 数据边界

- 训练记录、转写状态和 AI 反馈保存在 `localStorage`。
- 岗位准备包保存在 `localStorage` key `interview_os_job_packs`。
- 音频 Blob 保存在 IndexedDB `interview-os-recordings`。
- JSON 备份不包含音频 Blob。
- 当前没有账号、云数据库、真实 ASR、RAG 或完整面试舱。

## xlsx 风险隔离

项目使用 `xlsx@0.18.5` 解析用户本地选择的 `job.xlsx`。该依赖存在 npm advisory 且暂无官方修复版，本项目当前采取以下隔离：

- 只解析用户在浏览器中手动选择的本地文件。
- 不从远程 URL 自动拉取 Excel。
- 不执行 Excel 公式。
- 不把解析内容当 HTML 注入页面。
- 渲染岗位字段时使用 React 文本节点转义。
- 限制岗位表大小为 10 MB。

后续如果出现维护更活跃、兼容浏览器端并能读取多 sheet 的替代库，再评估迁移。

## V0.3B + V0.3C 严格验收

本轮交付新增 Playwright 端到端 dogfood：

```bash
npm run lint
npm run build
npm run test:ai
npx playwright test
```

`tests/interview-os.e2e.spec.ts` 会自动生成 `job.xlsx` fixture，验证上传岗位表、解析岗位、选择岗位、刷新持久化、训练稿岗位替换、录音保存、模拟转写、Mock AI 反馈、刷新后反馈保留，以及导出 JSON 包含 `selectedJob`、`trainingRecords`、`transcript` 和 `aiFeedback`。
