# 当前进度

- 已确认远端 `origin/main` 当前提交为 `4f1bfa8`，包含 `/latest` 岗位数据与 `/api/job-data/latest`。
- 已实现：前端打开网站自动同步 `latest/manifest.json` 与 `latest/jobs.json`；Raw 失败时 fallback 到 `/api/job-data/latest`。
- 已实现：同步状态保存到 `interview_os_remote_job_data`，并纳入 JSON 备份/导入/清空流程。
- 已验证：`npm run lint`、`npm run build`、`npm run test:ai`、`npm run test:providers`、`npx playwright test` 均通过。
- 本轮纠偏：顶部导航移除独立“训练”入口，首页指标从“三段录音”改为“模拟面试/面试题反馈”，选岗位后进入岗位准备包，后续考察统一导向模拟面试舱。
