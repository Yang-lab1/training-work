# 当前进度

- 已把模拟面试主控继续收敛为视频通话语义：主流程是“开始面试 / 通话控制 / 挂断”，不再把转写和反馈暴露为主按钮。
- 本轮修正：右下角“我的窗口”默认不渲染；用户点击摄像头按钮后才显示；窗口右上角可关闭，关闭后停止摄像头流并移除小窗。
- 本轮修正：面试官问题与候选人转写改为会议画面上的气泡式对话流，不再使用大题目卡片。
- 已修正候选人小窗层级问题，关闭按钮不再被面试官大画面遮挡。
- 本轮补齐：新建模拟面试后必须先进入候场知识包；旧的未回答面试房间会在刷新后自动回到候场材料；面试房间未接入前新增“先看面试要点”兜底。
- 本轮补齐：面试官问题接入浏览器 `speechSynthesis` 语音播放；点击“开始面试”后先由面试官发声，结束后自动进入候选人回答采集。
- 本轮补齐：复盘室新增“再来一轮模拟面试”主按钮，会重新生成 session 并先进入候场知识包。
- 紧急修复：TTS 不再因进入旧面试/复盘页自动触发；只有当前 session 在面试房间且用户本次点击“开始面试”后才允许面试官发声。
- 紧急修复：复盘页“再来一轮”按钮缩短文案并禁止换行，避免窄卡片内错行。
- 本地验证：`npm run lint`、`npm run build`、`npm run test:ai`、`npm run test:providers`、`npx playwright test` 均通过。
- 生产验证：`PLAYWRIGHT_BASE_URL=https://interview-os-pi.vercel.app npx playwright test` 通过；生产 API smoke 通过。
- 生产部署已完成并 alias 到 `https://interview-os-pi.vercel.app`。
- 生产 smoke 通过，新资源：`/assets/index-FhDZsySF.js`、`/assets/index-DVTBNUqo.css`。
- 生产 provider 状态：文本 provider 为 `deepseek` 且 analyze/jobPack/mockInterview smoke 成功；ASR provider 为 `doubao` 且凭证已配置，但真实流式转写实现仍是 `implemented:false`，当前转写 smoke 返回 `mock_fallback`。

## 下一步

- P0：完成豆包真实流式 ASR provider，让 `/api/transcribe` 对真实音频 Blob 不再 fallback mock。
- P1：继续把模拟面试底层从“分段录制 + 自动转写/分析”升级为真正的连续语音通话能力，需要接入实时语音或流式 ASR/对话 provider。
- 面试舱视觉仍需继续按真实会议软件打磨：更少状态文案、更自然的等待/接入/通话中状态、摄像头预览与通话控制更贴近 Zoom / 腾讯会议。
- 2026-06-17：豆包 TTS 面试官声音已接入 `/api/synthesize-speech`，生产环境 UTF-8 smoke 通过：`provider=doubao`、`model=seed-tts-2.0`、`isFallback=false`、返回 `audio/mpeg`。PowerShell 字符串直传中文会导致豆包返回 `No readable text!`，浏览器 fetch 与 UTF-8 字节请求正常。
- 2026-06-17：新增/修正 TTS provider 三段式兜底：V3 SSE、V3 HTTP chunked、旧 V1；补充常用中文音色名到 speaker id 映射，例如“小天” -> `zh_male_taocheng_uranus_bigtts`。
- 2026-06-17：本轮修正模拟面试完成后的产品流：面试舱只显示短结束态与“再来一轮 / 查看完整反馈”；完整模拟面试复盘归入“反馈”页；“再来一轮”会基于当前/历史岗位重新创建 session，并先进入面试前知识包。
