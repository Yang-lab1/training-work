# 发现与决策

## 需求
- 不再做虚拟上传、假流程、复杂导航和完整求职 OS。
- 只保留三个真实功能：
  - 真实文件上传并显示文件名/状态；
  - 真实浏览器录音并可回放/下载；
  - 真实今日训练任务并可勾选保存。
- 用户打开网站后应能马上上传 CV，练中文自我介绍、英文自我介绍、Miro 项目讲解，并保存当天训练记录。

## 当前实现
- `src/App.tsx` 已重写为单页个人 MVP，不再导入旧 workflow、data、logic、components 或 services。
- 文件选择使用真实 `<input type="file">`，显示文件名、大小、格式、选择时间和状态。
- 录音使用浏览器原生 `navigator.mediaDevices.getUserMedia` + `MediaRecorder`。
- 录音 Blob 保存到 IndexedDB：`interview-os-recordings` / `recordings`。
- 文件元数据、任务完成状态、录音 metadata 保存到 localStorage：`interview-os-personal-mvp-v1`。
- 任务固定为三项：
  - 中文自我介绍；
  - 英文自我介绍；
  - Miro 项目讲解。

## 已删除/替换的旧体验
- 不再展示顶部导航、Mega Menu、阶段进度条。
- 不再展示能力摸底、训练计划、公司准备、面试舱、复盘、成长地图等复杂模块入口。
- 不再展示虚拟上传状态或 mock 解析流程。
- 不再使用旧版 locked skeleton 和完整 OS 主线。

## 验证结果
- `npm run lint` 通过。
- `npm run build` 通过：
  - JS `/assets/index-Cy3awJbZ.js`
  - CSS `/assets/index-ChCWTZD8.css`
- 本地 Playwright MVP QA 通过：
  - 真实选择 `qa-cv.txt` fixture 文件；
  - 页面显示文件名和 `已选择` 状态；
  - 使用 fake microphone 触发真实 MediaRecorder；
  - 生成 audio 控件；
  - 生成 `下载录音` 链接；
  - 勾选英文自我介绍和 Miro 项目讲解；
  - 刷新后文件名、3/3 完成状态和中文录音 audio 仍可见；
  - 移动端无横向溢出。
- 生产 Playwright MVP QA 同样通过。

## 生产部署
- Public URL：`https://interview-os-pi.vercel.app`
- Vercel deployment ID：`dpl_ABHowgstwKvadqzuy5KBpseaced4`
- Deployment URL：`https://interview-qhwndswp0-yangs-projects-d2ad4c9e.vercel.app`
- Last-Modified：`Fri, 05 Jun 2026 13:28:59 GMT`
- JS：`/assets/index-Cy3awJbZ.js`
- CSS：`/assets/index-ChCWTZD8.css`
- Vercel inspect：production / Ready

## QA 截图
- `tmp/interview-os-mvp-local-desktop.png`
- `tmp/interview-os-mvp-local-mobile.png`
- `tmp/interview-os-mvp-prod-desktop.png`
- `tmp/interview-os-mvp-prod-mobile.png`

## 注意
- 文件内容不会上传服务器；当前只保存浏览器可见的文件 metadata。
- 录音保存到本机浏览器 IndexedDB；清缓存会删除录音。
- 本版没有真实 ASR、评分、面试官、RAG 或公司研究。

## V0.1.3 发现与决策

- 用户需要的是明天能持续练习的个人 MVP，不是恢复复杂 Interview OS。因此本次只做训练体验增强和 CV 状态透明。
- 简历解析不能假装完成：TXT/MD/text 在浏览器本地真实读取；PDF/DOC/DOCX 暂不解析，显示手动粘贴入口。
- 目标岗位用单独 localStorage key `interview_os_target_role` 保存，避免和主 MVP 状态耦合。
- CV 文本用单独 localStorage key `interview_os_cv_text` 保存，便于后续真实解析或 ASR/RAG 接入时迁移。
- 最近训练历史只保存 metadata；音频仍以 IndexedDB 当前录音和用户下载文件为准。
- QA 发现：如果先上传 TXT 自动提取，再替换成 PDF，旧 TXT 文本会造成“PDF 被解析”的错觉。已修复为清除上传来源的旧文本；手动粘贴文本保留。

## V0.1.4 发现与决策

- 闭环 MVP 的关键不是新增复杂页面，而是在同一页把目标岗位、资料、三段训练、自评复盘、下一步任务、历史和备份串起来。
- 今日基础训练完成状态只看三段训练是否都有今日记录，不要求导出备份也完成；QA 曾发现这一点并已修正。
- 参考稿自定义只覆盖模板文本，目标岗位占位符替换在渲染时执行，因此用户自定义稿仍可使用 `【XXX岗位】` 和 `[XXX role]`。
- 下一步任务完全基于本地规则，不声称 AI 分析。
- 清空全部本地数据必须同时清 localStorage 和 IndexedDB 录音库，避免历史音频 Blob 残留。
