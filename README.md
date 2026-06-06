# Interview OS

岗位驱动的个人面试训练 MVP。当前版本支持：

- 上传 CV、项目资料和 `job.xlsx`
- 前端解析岗位库并选择目标岗位
- 中文自我介绍、英文自我介绍、Miro 项目讲解录音
- 回放、下载、标签复盘、训练历史和 JSON 备份
- 在训练记录详情中保存回答文本并生成结构化 AI 反馈

## 本地开发

```bash
npm install
npm run dev
```

Vite 本地开发服务器只负责前端。`/api/analyze-answer` 是 Vercel Function，完整联调可使用 Vercel
开发环境或部署后的地址。

## AI Provider

复制 `.env.example` 为本地环境配置，并按需设置：

```dotenv
AI_PROVIDER=mock
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DOUBAO_API_KEY=
DOUBAO_ENDPOINT=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

- 默认 `AI_PROVIDER=mock`，不需要任何 Key。
- `AI_PROVIDER=deepseek` 且配置 `DEEPSEEK_API_KEY` 时调用真实 DeepSeek 文本模型。
- DeepSeek 缺 Key、超时或调用失败时自动返回 `mock_fallback`。
- 豆包、OpenAI、Gemini 已预留配置和统一类型，目前自动回退 Mock。
- API Key 只能配置在服务端环境变量中，不允许使用 `VITE_` 前缀。

## API

`POST /api/analyze-answer`

输入一次训练记录、目标岗位、回答文本、时长、自评、CV 摘要和参考稿，返回统一结构：

- 总分和总结
- 优点与问题
- 岗位、结构、表达和时长反馈
- 30 秒与 90 秒优化版
- 下一步任务
- Provider、模型和生成时间

本版本不做 ASR。回答文本来自用户粘贴或模拟文本。

## 验证

```bash
npm run lint
npm run build
npm run test:ai
```

`test:ai` 覆盖 Mock Provider、DeepSeek 缺 Key 自动回退和非法输入校验。

## 数据边界

- 训练记录、回答文本和 AI 反馈保存在浏览器 `localStorage`。
- 录音 Blob 保存在浏览器 IndexedDB，长期保存仍以用户下载文件为准。
- 回答文本会在用户点击“生成 AI 反馈”后发送到后端 Provider。
- 当前没有账号、云端数据库、ASR、RAG、公司准备包或面试舱。
