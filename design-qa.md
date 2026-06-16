# Design QA

## Scope

本轮按 Product Design 判断修复模拟面试舱：

- 修复全屏面试后布局坍塌、控制按钮被拉成长竖条的问题。
- 将面试舱从“录音训练页”进一步改成“语音 / 视频通话式面试窗口”。
- 移除主流程中的“下一题 / 继续追问 / 完成本轮”按钮，改为系统自动推进追问或后续问题。
- 底部控制栏只保留会议控制语义：麦克风、回放、挂断。
- 备用转写 / 反馈入口默认隐藏，不作为正式主流程。

## Screenshots Checked

- `test-results/interview-os.e2e-*/interview-room.png`
- 桌面 Chromium 与 mobile Chromium viewport 均已覆盖。

## Product Design Judgment

- 面试官画面重新成为主视觉焦点。
- 全屏面试使用固定三段会议布局：顶部状态栏、中间视频舞台、底部通话控制栏。
- 控制栏不再像任务按钮组；“开始发言 / 结束发言”已移除。
- “下一题”不再作为用户操作出现；系统在后台自动进入追问或继续提问。
- 右侧资料 / 反馈面板默认不打扰面试，只作为辅助信息入口。
- 当前版本仍不是真实 WebRTC 视频通话，但视觉和交互已经更接近线上语音/视频面试舱。

## Impeccable Review

- `npm run lint` 通过。
- `npm run build` 通过。
- `npm run test:ai` 通过。
- `npm run test:providers` 通过。
- `npx playwright test` 通过桌面与移动端。
- E2E 已新增对全屏舞台尺寸、控制条高度、按钮横向形态、无“下一题”主按钮、自动推进流程的断言。

## Result

passed
