# 当前进度

- 已完成 AGNES 公司/岗位面试知识包 provider 配置与线上验证。
- 当前线上分工：普通文本反馈走 DeepSeek；公司/岗位面试知识包走 AGNES。
- 已把“公司资料”从用户前台导航中移除，不再作为独立用户流程暴露。
- 选中岗位后，系统会先在后台生成岗位面试资料，再自动生成公司/岗位面试知识包。
- 模拟面试入口现在要求岗位资料和公司知识包都准备好；未就绪时只显示“面试资料正在后台准备”。
- 系统诊断页已显示任务级 provider 分工，避免误以为所有文本任务都走 DeepSeek。
- Playwright 已补充公司知识包 mock，覆盖后台知识包准备链路。
- `npm run lint`、`npm run build`、`npm run test:ai`、`npm run test:providers`、`npx playwright test` 均已通过。
- 已提交并推送 `dbe09d0 training work`，已部署到 `https://interview-os-pi.vercel.app`。

## 下一步

- 继续把面试舱做成更接近真实语音/视频通话的体验，减少“题目按钮式”交互。
- 如需要真实实时语音，需要进一步接入实时 ASR / 对话模型 / 音频流能力；当前仍是录音片段转写闭环。
