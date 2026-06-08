# Interview OS

岗位驱动的个人 AI 面试训练 MVP。

当前主流程：

1. 上传 CV、项目资料和 `job.xlsx`
2. 从岗位库选择目标岗位
3. 完成中文介绍、英文介绍或 Miro 项目讲解录音
4. 保存本地录音记录
5. 调用 `/api/transcribe` 生成转写
6. 调用 `/api/analyze-answer` 生成 AI 评分、诊断、修改稿和下一步任务
7. 生成岗位准备包
8. 进入岗位定向模拟面试，完成一问一答和整场复盘
9. 上传真实面试录音，生成真实面试复盘并反补题库
10. 上传公司资料，生成公司知识包并增强岗位准备包

用户不需要填写自评分、问题标签、训练状态或改进建议。旧记录中的 `review` 只作为兼容数据展示，不参与新评价逻辑。

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
DOUBAO_MODEL=

OPENAI_API_KEY=
OPENAI_MODEL=

GEMINI_API_KEY=
GEMINI_MODEL=

AGNES_API_KEY=
AGNES_BASE_URL=
AGNES_MODEL=
```

- 默认使用 Mock，不需要 Key。
- DeepSeek 文本 Provider 已实现可配置路径。
- 设置 `AI_PROVIDER=deepseek` 且提供 `DEEPSEEK_API_KEY` 时，文本反馈、岗位准备包、模拟面试、真实面试复盘和公司知识包都可走 DeepSeek OpenAI-compatible chat completion。
- Key 缺失、Key 错误、请求超时、HTTP 错误、输出非 JSON 或字段缺失时自动回退 `mock_fallback`。
- 豆包、OpenAI、Gemini、AGNES 已预留；未启用或未实现时回退 Mock。
- Key 只从服务端环境变量读取，不进入前端 Bundle。

## ASR Provider

```dotenv
ASR_PROVIDER=mock

OPENAI_API_KEY=
OPENAI_ASR_MODEL=whisper-1

DOUBAO_ASR_API_KEY=
DOUBAO_ASR_ENDPOINT=
DOUBAO_ASR_MODEL=

VOLCENGINE_ASR_API_KEY=
VOLCENGINE_ASR_ENDPOINT=
XFYUN_ASR_API_KEY=
ALIYUN_ASR_API_KEY=
TENCENT_ASR_API_KEY=
```

- `/api/transcribe`、Mock ASR 和 OpenAI ASR 可配置实现已存在。
- 前端能从 IndexedDB 读取训练录音 Blob，并用 `multipart/form-data` 发送到 `/api/transcribe`。
- `ASR_PROVIDER=openai` 且 `OPENAI_API_KEY` 存在时，服务端会把音频传给 OpenAI transcription API。
- 缺少 Key、真实 Provider 失败或未实现时返回 `mock_fallback`，不会阻断训练。
- 豆包、火山、讯飞、阿里云、腾讯云 ASR Provider 接口已预留。

## API

### `POST /api/transcribe`

接收 JSON mock 请求或 `multipart/form-data` 音频请求，返回统一转写结果：

- `provider`
- `model`
- `transcript`
- `language`
- `durationSeconds`
- `generatedAt`

### `POST /api/analyze-answer`

接收转写文本、岗位、训练类型、时长、CV 摘要和参考稿，返回：

- 总分和总结
- 优点与主要问题
- 岗位、结构、表达、时长、流畅度、背稿风险、具体性反馈
- 30 秒与 90 秒优化稿
- 下一步训练任务

该接口不接收或依赖用户自评。

### `POST /api/generate-job-pack`

根据 `selectedJob`、CV 文本、训练记录、AI 反馈、参考稿和可选 `companyKnowledgePack` 生成岗位准备包。准备包是学习资料和高概率方向，不是面试舱固定题库。

### `POST /api/generate-mock-interview`

根据 `selectedJob`、岗位准备包、公司知识包、真实面试反补题库、CV 文本和训练记录生成岗位定向模拟面试问题。Mock 至少返回 6 个问题。

### `POST /api/generate-follow-up`

根据当前问题、回答转写和单题 AI 反馈生成追问。

### `POST /api/generate-interview-report`

根据整场问题、回答转写和单题反馈生成模拟面试整场复盘。

### `POST /api/review-real-interview`

根据真实面试转写、岗位准备包、模拟面试和训练记录生成真实面试复盘：

- 提取面试官问题
- 提取用户回答
- 对比准备包和模拟面试命中情况
- 生成复盘报告
- 生成 `questionBankUpdates`

### `POST /api/generate-company-knowledge-pack`

根据 `selectedJob`、岗位准备包、公司资料源、CV 文本和真实面试复盘生成公司知识包：

- 公司核心业务
- 产品线
- 近期信号
- 岗位语境
- 面试关注点预测
- 风险与未知
- `evidenceMap` 来源引用
- 推荐问题
- 面试使用建议

## 公司资料安全边界

当前版本以用户上传 TXT / Markdown / HTML 文本资料为主，不做无控制网页抓取。

- 不抓取需要登录、付费、私有或受限页面。
- 不从网页 HTML 注入 UI。
- HTML 上传只做文本提取，不执行脚本。
- 后续如果加入 server-side URL fetch，必须限制 http/https、禁止 localhost/内网/metadata IP、设置超时和响应大小上限。

## 数据边界

- 训练记录、转写状态和 AI 反馈保存在 `localStorage`。
- 岗位准备包保存在 `interview_os_job_packs`。
- 模拟面试 session 保存在 `interview_os_mock_interviews`。
- 真实面试复盘保存在 `interview_os_real_interviews`。
- 真实面试题库反补保存在 `interview_os_question_bank`。
- 公司资料源保存在 `interview_os_company_sources`。
- 公司知识包保存在 `interview_os_company_knowledge_packs`。
- 音频 Blob 保存在 IndexedDB `interview-os-recordings`。
- JSON 备份不包含音频 Blob。
- 当前没有账号、云数据库、RAG 或实时视频面试舱。

## xlsx 风险隔离

项目使用 `xlsx@0.18.5` 解析用户本地选择的 `job.xlsx`。该依赖存在 npm advisory 且暂无官方修复版，本项目当前采取以下隔离：

- 只解析用户在浏览器中手动选择的本地文件。
- 不从远程 URL 自动拉取 Excel。
- 不执行 Excel 公式。
- 不把解析内容当 HTML 注入页面。
- 渲染岗位字段时使用 React 文本节点转义。
- 限制岗位表大小为 10 MB。

后续如果出现维护更活跃、兼容浏览器端并能读取多 sheet 的替代库，再评估迁移。

## 验证

```bash
npm run lint
npm run build
npm run test:ai
npx playwright test
```

`npm run test:ai` 覆盖 Mock 文本反馈、DeepSeek 可配置路径、DeepSeek 缺 Key 回退、输入校验、Mock ASR、OpenAI ASR 缺 Key 回退、真实面试复盘和公司知识包。

`npx playwright test` 会自动生成 fixture，验证上传岗位表、解析岗位、选择岗位、刷新持久化、训练保存、模拟转写、Mock AI 反馈、岗位准备包、模拟面试、整场复盘、真实面试复盘、题库反补、公司资料上传、公司知识包生成、重新生成岗位准备包，以及导出 JSON 包含 `selectedJob`、`trainingRecords`、`transcript`、`aiFeedback`、`jobPacks`、`mockInterviews`、`realInterviews`、`questionBank`、`companySources` 和 `companyKnowledgePacks`。
