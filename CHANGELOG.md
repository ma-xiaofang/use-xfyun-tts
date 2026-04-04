# 更新日志

## [0.0.1] - 2024-04-04

### 新增

#### 多平台支持

- **Android 平台**: 使用原生 `MediaPlayer` 播放音频，支持音频文件缓存到应用沙箱目录
- **iOS 平台**: 使用原生 `AVAudioPlayer` 播放音频，支持音频文件缓存到 Documents 目录
- **H5 平台**: 使用 `Audio` 元素 + `Blob URL` 播放，自动释放内存
- **微信小程序平台**: 使用 `InnerAudioContext` 播放，自动清理临时文件

#### 核心功能

- **WebSocket 连接**: 通过 `uni.connectSocket` 连接讯飞 TTS 流式语音合成服务
- **音频解码**: 各平台使用对应 API 解码 Base64 音频数据
- **文件缓存**: 使用文本 MD5 哈希值作为文件名，相同文本直接播放缓存文件
- **资源管理**: 组件卸载时自动调用 `stop()` 释放资源，防止内存泄漏

#### 语音参数

- **发音人**: 支持多种发音人（小燕、小宇、小峰等）
- **语速**: 0-100 可调
- **音量**: 0-100 可调
- **音调**: 0-100 可调

#### 回调函数

- `onStart`: WebSocket 连接成功回调
- `onProgress`: 音频数据接收进度回调
- `onEnd`: 播放结束回调
- `onError`: 错误回调

### 技术实现

- 使用 Vue 3 Composition API（`ref`, `onUnmounted`）
- 使用 `crypto-js` 进行 MD5 哈希和 HMAC-SHA256 签名
- 使用 `js-base64` 进行 Base64 编码（H5 平台）
- 使用条件编译实现多平台适配
- 支持 uni-app 3.0+ 和 Vue 3.x
