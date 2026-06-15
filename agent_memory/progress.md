# 当前进度

- 已确认远端 `origin/main` 当前提交为 `4f1bfa8`，包含 `/latest` 岗位数据与 `/api/job-data/latest`。
- 已实现：前端打开网站自动同步 `latest/manifest.json` 与 `latest/jobs.json`；Raw 失败时 fallback 到 `/api/job-data/latest`。
- 已实现：同步状态保存到 `interview_os_remote_job_data`，并纳入 JSON 备份/导入/清空流程。
- 已验证：`npm run lint`、`npm run build`、`npm run test:ai`、`npm run test:providers`、`npx playwright test` 均通过。
- 本轮纠偏：顶部导航移除独立“训练”入口，首页指标从“三段录音”改为“模拟面试/面试题反馈”，选岗位后进入岗位准备包，后续考察统一导向模拟面试舱。
- 本轮收口：顶部导航压缩为“今日 / 资料与岗位 / 模拟面试 / 反馈”四个主入口；岗位准备包、真实复盘、公司资料、面试记录、数据管理、系统诊断收进“我的”菜单。
- 本轮收口：每页重复的大标题与副标题改为仅屏幕阅读器可见，视觉上取消“导航标签 + 页面大标题”的重复；首页主 CTA 字号和高度下调，更像 daily driver 工作台。
- 本轮收口：旧“训练历史/训练记录/最近训练”等用户可见文案迁移为“面试记录/面试练习/下一轮准备”，避免产品回到录音训练器。
