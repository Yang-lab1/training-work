# Design QA

## Scope

本轮按 Product Design 的 Interview Room First 方向纠偏：

- 岗位准备资料改为后台自动生成，只向用户显示准备状态。
- 岗位列表不再展开内部处理节点。
- 模拟面试改为大厅、等待室、正式面试房间和复盘室。
- 正式面试房间以虚拟面试官为视觉焦点，资料面板默认关闭。

## Screenshots Checked

- `test-results/interview-os.e2e-*/materials-and-jobs.png`
- `test-results/interview-os.e2e-*/interview-lobby.png`
- `test-results/interview-os.e2e-*/interview-room.png`
- 同时检查 desktop Chromium 与 Pixel 5 viewport。

## Product Design Judgment

- 岗位筛选复选框尺寸与其他控件一致，不再出现异常大图标。
- 岗位准备不再作为独立导航或内容页面，用户只看到“准备中 / 已就绪 / 失败”。
- 面试大厅只有岗位、面试类型、准备状态和一个主操作。
- 面试房间使用单一深色会议画面，面试官是视觉焦点。
- 当前问题、候选人窗口与控制栏层级清楚，右侧资料默认收起。
- 桌面和移动端均没有文字、候选人窗口或控制栏互相遮挡。
- 页面切换会回到顶部，不再把上一页滚动位置带入面试舱。

## Impeccable Review

- 后台自动准备失败时保留重试入口，不会让用户进入未准备完成的面试。
- 大厅到等待室再到正式面试房间的状态链路已恢复。
- 全屏、资料抽屉、录音、自动转写、AI 反馈、复盘和备份路径均由 Playwright 覆盖。
- 移动端资料抽屉开关移入状态栏，不再出现可见但无法点击的浮层按钮。

## Result

passed
