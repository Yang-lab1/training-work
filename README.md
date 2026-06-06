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
DEEPSEEK_MODEL=deepseek-chat
DOUBAO_API_KEY=
DOUBAO_ENDPOINT=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

- 默认使用 Mock，不需要 Key。
- DeepSeek 文本 Provider 已实现。
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

## 验证

```bash
npm run lint
npm run build
npm run test:ai
```

`test:ai` 覆盖文本 Mock、DeepSeek 缺 Key 回退、输入校验、Mock ASR 和 ASR 缺 Key 回退。

## 数据边界

- 训练记录、转写状态和 AI 反馈保存在 `localStorage`。
- 音频 Blob 保存在 IndexedDB `interview-os-recordings`。
- JSON 备份不包含音频 Blob。
- 当前没有账号、云数据库、真实 ASR、RAG、公司准备包或完整面试舱。
