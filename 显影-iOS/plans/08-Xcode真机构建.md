# Xcode 真机构建流程

## 工程结论

- 主工程：`显影/ios/App/App.xcodeproj`
- Web 资源：`显影/ios/App/App/public/`（由 `cap sync` 同步）
- 同步目标：将 `显影/build/` 复制到 iOS 工程

## 执行步骤

```bash
# 1. 构建 Web 资源
cd ~/Desktop/XianYing/显影
npm run build

# 2. 同步到 iOS 工程
npx cap sync ios

# 3. 打开 Xcode 工程
npx cap open ios
```

## Xcode 中操作

1. 选择目标设备（真机）
2. Signing & Capabilities → 勾选 Automatically manage signing
3. Team → 选择 Personal Team
4. Bundle Identifier → 改为唯一值（如 `com.briancao.xianying`）
5. 点击 ▶ Build & Run

## 常见失败与处理

| 问题 | 解决方案 |
|------|----------|
| codesign 弹窗要求密码 | 输入 Mac 登录密码（login keychain） |
| Bundle ID 冲突 | 修改为唯一 Bundle Identifier |
| 签名 7 天过期 | 重新在 Xcode 中 Run |
| 设备未信任 | iPhone → 设置 → 通用 → VPN与设备管理 → 信任 |
| 开发者模式未开启 | 设置 → 隐私与安全性 → 开发者模式 |
| NSPOSIXErrorDomain Code 3 | 检查模拟器/设备连接状态 |
| SPM 依赖缺失 | `xcodebuild -resolvePackageDependencies` |

## 构建流转图

```
npm run build → dist/
  ↓
npx cap sync ios → ios/App/App/public/
  ↓
Xcode Build → .app
  ↓
Install on iPhone
```
