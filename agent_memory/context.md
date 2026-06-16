# 项目上下文

- 项目：Interview OS，本地路径 `C:\Users\Yang\Documents\New project\interview-os`。
- 当前重点：让网站打开后可自动读取 `Yang-lab1/training-work/main/latest` 下的岗位 JSON 数据，同时保留手动上传 `job.xlsx` 的兜底路径。
- 数据源：公开仓库优先读取 GitHub Raw；未来私有仓库走 `/api/job-data/latest` 服务端代理，前端不放 token。
- 当前模拟面试交互基调：前台尽量表现为“公司定向语音通话式面试”，岗位准备包和公司知识包留在后台准备，不把技术处理过程直接暴露给用户。
