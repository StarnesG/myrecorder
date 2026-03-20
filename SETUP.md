# myrecorder — iOS 录音应用

基于 Capacitor 7 + Vite 构建的 iOS 录音应用，使用 `capacitor-voice-recorder` 插件实现录音功能，通过 iOS 系统分享面板将录音文件保存到「文件」App。

---

## 项目结构

```
myrecorder/
├── capacitor-voice-recorder/   # 本地插件源码
├── src/
│   ├── index.html              # 应用页面（含 CSS）
│   └── main.ts                 # 应用逻辑
├── capacitor.config.json       # Capacitor 配置
├── vite.config.js              # Vite 构建配置
└── package.json
```

---

## 环境要求

| 工具 | 版本要求 |
|------|----------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Xcode | ≥ 15 |
| CocoaPods | ≥ 1.13 |
| iOS 部署目标 | ≥ 13.0 |

---

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

> `capacitor-voice-recorder` 以本地路径 `file:./capacitor-voice-recorder` 引用，`npm install` 会自动构建插件（触发其 `prepare` 脚本）。

### 2. 构建 Web 资源

```bash
npm run build
```

输出到 `dist/` 目录，对应 `capacitor.config.json` 中的 `webDir`。

### 3. 添加 iOS 平台（首次）

```bash
npx cap add ios
```

### 4. 同步到 iOS 项目

每次修改 Web 代码或插件后执行：

```bash
npm run build && npx cap sync ios
```

### 5. 配置 Info.plist（必须）

在 Xcode 中打开 `ios/App/App/Info.plist`，添加麦克风权限描述：

```xml
<key>NSMicrophoneUsageDescription</key>
<string>需要麦克风权限以录制音频。</string>
```

或在 Xcode → Target → Info → Custom iOS Target Properties 中添加：
- Key: `Privacy - Microphone Usage Description`
- Value: `需要麦克风权限以录制音频。`

### 6. 在 Xcode 中运行

```bash
npx cap open ios
```

在 Xcode 中选择真机（录音功能需要真机，模拟器麦克风受限），点击 Run。

---

## 开发调试

本地预览（仅测试 UI，录音功能需真机）：

```bash
npm run dev
```

---

## 功能说明

| 功能 | 说明 |
|------|------|
| 开始录音 | 点击红色麦克风按钮，首次使用会弹出麦克风权限请求 |
| 停止录音 | 再次点击按钮，录音文件出现在下方列表 |
| 播放 | 点击列表项的「播放」按钮，在应用内直接播放 |
| 保存 | 点击「保存」按钮，弹出 iOS 分享面板，可保存到「文件」App 或通过 AirDrop 分享 |
| 中断处理 | 来电等系统中断时录音自动暂停，中断结束后可继续停止并保存 |

---

## 录音文件格式

| 场景 | 格式 | MIME 类型 |
|------|------|-----------|
| 正常录音 | AAC | `audio/aac` |
| 录音中被中断后合并 | M4A | `audio/mp4` |

---

## 依赖说明

| 包 | 用途 |
|----|------|
| `@capacitor/core` | Capacitor 核心运行时 |
| `@capacitor/ios` | iOS 平台支持 |
| `@capacitor/filesystem` | 将录音写入设备文件系统 |
| `@capacitor/share` | 调用 iOS 系统分享面板保存文件 |
| `capacitor-voice-recorder` | 录音插件（本地引用） |
| `vite` | 构建工具 |
| `@capacitor/cli` | Capacitor CLI（cap sync / cap open） |

---

## 常见问题

**Q: 点击录音按钮没有反应**  
A: 检查 `Info.plist` 是否已添加 `NSMicrophoneUsageDescription`，缺少此项 iOS 会静默拒绝权限请求。

**Q: `npm install` 报错，提示插件构建失败**  
A: 进入 `capacitor-voice-recorder/` 目录手动执行 `npm install && npm run build`，再回到根目录重新 `npm install`。

**Q: `npx cap sync` 提示找不到 iOS 平台**  
A: 先执行 `npx cap add ios`。

**Q: 保存按钮点击后没有弹出分享面板**  
A: 确认在真机上运行，模拟器的分享功能受限。
