# Capacitor iOS 打包与 React 迁入

## 技术栈选型

- **前端**：React 18 + TypeScript + Vite
- **移动端**：Capacitor（而非 React Native / Cordova）
- **理由**：保留 Web 标准、迁移成本最低、原生插件可扩展

## 目录结构

```
显影/
├── src/              # React 源码
├── public/           # 静态资源
├── build/            # Vite 构建输出
├── ios/              # Capacitor iOS 工程
│   └── App/
│       └── App.xcodeproj
├── server/           # Node.js 代理
├── capacitor.config.json
├── vite.config.ts
├── package.json
└── index.html
```

## 迁入步骤

1. 解压 `Flow_显·影.zip`
2. 将 React 源码移入 `显影/src/`
3. 配置 Vite 构建输出到 `build/`
4. 初始化 Capacitor：`npx cap init`
5. 添加 iOS 平台：`npx cap add ios`
6. 构建并同步：`npm run build && npx cap sync ios`
7. 在 Xcode 中打开并运行

## 移动端适配问题

- 滚动行为修复
- 安全区 (Safe Area) 适配
- 衬线体在移动端的渲染
- 哈希颜色模块兼容

## Toast 与作品库修复

- Toast 位置调整适配移动端
- 成功图标样式修正
- 作品库操作逻辑（保存/删除/分享）
