# src/ 目录索引

> 本目录是显·影 App 的全部前端源码。以下是每个文件和子目录的职责。

---

## 入口文件

| 文件 | 职责 | 你需要知道的 |
|---|---|---|
| `main.tsx` | 应用启动入口 | 把 React App 挂载到 HTML 页面，通常不需要改 |
| `App.tsx` | 路由与状态中枢 | **核心文件**：所有页面的切换逻辑和数据传递都在这里 |
| `index.css` | 全局样式入口 | 引入 Tailwind CSS 和自定义样式文件 |

---

## 子目录

| 目录 | 内容 | 说明 |
|---|---|---|
| `components/` | 页面组件 + 功能组件 + UI 组件库 | **日常开发的主战场**，详见 `components/_INDEX.md` |
| `styles/` | 全局 CSS 变量和主题 | `globals.css` 定义了颜色、字体、间距等设计 token |
| `utils/` | 工具函数 | 目前只有 `speakerColors.ts`（发言人颜色分配） |
| `guidelines/` | AI 开发规范 | `Guidelines.md` 是给 AI 助手的开发规则模板 |

---

## 文档文件

| 文件 | 内容 |
|---|---|
| `README.md` | 项目功能说明、用户流程、技术栈介绍 |
| `Attributions.md` | 第三方资源致谢 |
