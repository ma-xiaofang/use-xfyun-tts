# useXfyunTTS() Uni-app HOOK

讯飞语音合成（TTS）uni-app Hook，支持 Android、iOS、H5、微信小程序多平台。

## 如何获取讯飞开发者apiKey？

1. 访问 [讯飞开放平台](https://www.xfyun.cn/) 并注册账号
2. 进入 [控制台](https://console.xfyun.cn/) 创建应用
3. 在应用详情页获取以下信息：
   - **APPID**: 应用 ID
   - **API Key**: API 密钥
   - **API Secret**: API 密钥
4. 开通「语音合成」服务（在线语音合成-流式版）

## 平台支持

| 平台       | 实现文件              | 播放方式          |
| ---------- | --------------------- | ----------------- |
| Android    | useXfyunTTSAndroid.js | MediaPlayer       |
| iOS        | useXfyunTTSIos.js     | AVAudioPlayer     |
| H5         | useXfyunTTSH5.js      | Audio             |
| 微信小程序 | useXfyunTTSWx.js      | InnerAudioContext |

## 实现方案

### Android

- **WebSocket**: `uni.connectSocket` 连接讯飞 TTS 服务
- **音频解码**: `android.util.Base64` 解码 Base64 音频数据
- **文件存储**: `java.io.FileOutputStream` 写入 MP3 到 `Environment.DIRECTORY_MUSIC`
- **文件命名**: 文本 MD5 哈希值，实现缓存
- **音频播放**: `android.media.MediaPlayer` 原生播放器

### iOS

- **WebSocket**: `uni.connectSocket` 连接讯飞 TTS 服务
- **音频解码**: `NSData.initWithBase64EncodedStringoptions` 解码
- **文件存储**: `NSFileManager` 写入 Documents 目录
- **文件命名**: 文本 MD5 哈希值，实现缓存
- **音频播放**: `AVAudioPlayer` 原生播放器
- **播放监听**: `NSNotificationCenter` 监听播放结束通知

### H5

- **WebSocket**: 原生 `WebSocket` API
- **音频解码**: `atob()` 解码 Base64，`Uint8Array` 转二进制
- **音频播放**: `Audio` 元素 + `Blob URL`
- **资源释放**: `URL.revokeObjectURL()` 释放内存

### 微信小程序

- **WebSocket**: `wx.connectSocket` API
- **音频解码**: `wx.base64ToArrayBuffer()` 解码
- **文件存储**: `wx.getFileSystemManager()` 写入临时目录
- **音频播放**: `wx.createInnerAudioContext()` 播放器
- **资源释放**: 播放结束后 `fs.unlink()` 删除临时文件

## 安装

### 方式一：npm 安装

```bash
npm install @ma-xiaofang/use-xfyun-tts

# 或 yarn
yarn add @ma-xiaofang/use-xfyun-tts

# 或 pnpm
pnpm add @ma-xiaofang/use-xfyun-tts
```

安装后直接导入使用：

```js
import useXfyunTTS from '@ma-xiaofang/use-xfyun-tts'
const { isPlaying, isConnected, error, synthesize, stop } = useXfyunTTS()
```

### 方式二：手动引入

将 `useXfyunTTS` 文件夹复制到项目的 `hooks` 目录下，然后手动导入：

```js
import useXfyunTTS from '@/hooks/useXfyunTTS/index.js'
const { isPlaying, isConnected, error, synthesize, stop } = useXfyunTTS()
```

## 依赖

```bash
npm install crypto-js js-base64
```

## 使用示例

```html
<template>
  <view class="container">
    <view class="form">
      <view class="form-item">
        <text class="label">appId</text>
        <input class="input" v-model="appId" placeholder="请输入讯飞 APP ID" />
      </view>

      <view class="form-item">
        <text class="label">apiKey</text>
        <input
          class="input"
          v-model="apiKey"
          placeholder="请输入讯飞 API Key"
          password
        />
      </view>

      <view class="form-item">
        <text class="label">apiSecret</text>
        <input
          class="input"
          v-model="apiSecret"
          placeholder="请输入讯飞 API Secret"
          password
        />
      </view>

      <view class="form-item">
        <text class="label">文本内容</text>
        <textarea
          class="textarea"
          v-model="text"
          placeholder="请输入要转换的文本（少于2000字符）"
        />
        <text class="char-count">{{ text.length }}/2000</text>
      </view>

      <view class="form-item">
        <text class="label">发音人</text>
        <picker
          mode="selector"
          :range="voiceList"
          range-key="name"
          @change="onVoiceChange"
        >
          <view class="picker">
            <text>{{ currentVoice.name }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">语速 (0-100)</text>
        <slider
          :value="speed"
          min="0"
          max="100"
          show-value
          @change="onSpeedChange"
        />
      </view>

      <view class="form-item">
        <text class="label">音量 (0-100)</text>
        <slider
          :value="volume"
          min="0"
          max="100"
          show-value
          @change="onVolumeChange"
        />
      </view>

      <view class="form-item">
        <text class="label">音调 (0-100)</text>
        <slider
          :value="pitch"
          min="0"
          max="100"
          show-value
          @change="onPitchChange"
        />
      </view>
    </view>

    <view class="actions">
      <button
        class="btn btn-primary"
        :disabled="isPlaying"
        @click="handleSynthesize"
      >
        {{ isPlaying ? '合成中...' : '合成播放' }}
      </button>
      <button class="btn" :disabled="!isPlaying" @click="handleStop">
        停止
      </button>
    </view>

    <view class="log">
      <text class="log-title">日志</text>
      <scroll-view class="log-content" scroll-y>
        <text
          v-for="(log, index) in logs"
          :key="index"
          :class="'log-' + log.type"
          >{{ log.msg }}</text
        >
      </scroll-view>
      <button class="btn-clear" @click="clearLogs">清空日志</button>
    </view>
  </view>
</template>

<script setup>
  import { ref } from "vue";
  import useXfyunTTS from "@/hooks/useXfyunTTS/index.js";
  const { isPlaying, isConnected, error, synthesize, stop } = useXfyunTTS();
  // 表单数据
  const appId = ref("your_app_id");
  const apiKey = ref("your_api_key");
  const apiSecret = ref("your_api_secret");
  const text = ref("您好，我是讯飞TTS语音合成工具。");
  // 语音参数
  const speed = ref(50);
  const volume = ref(50);
  const pitch = ref(50);
  // 发音人列表
  const voiceList = ref([
    { name: "叶子 - 青年女声", value: "x4_yezi" },
    { name: "小宇 - 青年男声", value: "xiaoyu" },
    { name: "小蓉 - 四川话女声", value: "xiaorong" },
    { name: "小芸 - 东北话女声", value: "xiaoyun" },
    { name: "小强 - 青年男声", value: "xiaoqiang" },
    { name: "小丹 - 陕西话女声", value: "xiaodan" },
    { name: "小北 - 阳江话女声", value: "xiaobei" },
    { name: "小东 - 河南话男声", value: "xiaodong" },
  ]);
  const currentVoice = ref(voiceList.value[0]);
  // 日志
  const logs = ref([]);
  const addLog = (msg, type = "info") => {
    const time = new Date().toLocaleTimeString();
    logs.value.push({ msg: `[${time}] ${msg}`, type });
  };
  const clearLogs = () => {
    logs.value = [];
  };

  // 语音参数变化
  const onVoiceChange = (e) => {
    currentVoice.value = voiceList.value[e.detail.value];
  };

  const onSpeedChange = (e) => {
    speed.value = e.detail.value;
  };

  const onVolumeChange = (e) => {
    volume.value = e.detail.value;
  };

  const onPitchChange = (e) => {
    pitch.value = e.detail.value;
  };

  // 处理合成
  const handleSynthesize = () => {
    // 参数验证
    if (!appId.value) {
      uni.showToast({ title: "请输入 APP ID", icon: "none" });
      return;
    }

    if (!apiKey.value) {
      uni.showToast({ title: "请输入 API Key", icon: "none" });
      return;
    }

    if (!apiSecret.value) {
      uni.showToast({ title: "请输入 API Secret", icon: "none" });
      return;
    }

    if (!text.value.trim()) {
      uni.showToast({ title: "请输入文本内容", icon: "none" });
      return;
    }

    if (text.value.length > 2000) {
      uni.showToast({ title: "文本内容请控制在2000字符以内", icon: "none" });
      return;
    }

    clearLogs();
    addLog("开始连接讯飞TTS服务...");

    synthesize({
      appId: appId.value,
      apiKey: apiKey.value,
      apiSecret: apiSecret.value,
      text: text.value,
      voice: currentVoice.value.value,
      speed: speed.value,
      volume: volume.value,
      pitch: pitch.value,
      onStart: () => {
        addLog("WebSocket连接成功，开始合成", "success");
      },
      onProgress: (data) => {
        addLog(`接收音频数据: ${data.audioSize} bytes`);
      },
      onEnd: () => {
        addLog("合成完成，播放结束", "success");
      },
      onError: (err) => {
        addLog(`错误: ${err}`, "error");
      },
    });
  };

  // 处理停止
  const handleStop = () => {
    stop();
    addLog("已停止");
  };
</script>

<style>
  .container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding-bottom: 50rpx;
  }

  .header {
    padding: 40rpx 30rpx;
    background-color: #007aff;
  }

  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #ffffff;
  }

  .form {
    padding: 30rpx;
  }

  .form-item {
    margin-bottom: 30rpx;
    position: relative;
    z-index: 1;
  }

  .label {
    display: block;
    font-size: 28rpx;
    color: #333333;
    margin-bottom: 15rpx;
  }

  .input {
    width: 100%;
    height: 80rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    background-color: #ffffff;
    border-radius: 10rpx;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
  }

  .textarea {
    width: 100%;
    height: 200rpx;
    padding: 20rpx;
    font-size: 28rpx;
    background-color: #ffffff;
    border-radius: 10rpx;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
  }

  .char-count {
    display: block;
    text-align: right;
    font-size: 22rpx;
    color: #999999;
    margin-top: 10rpx;
  }

  .picker {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx;
    background-color: #ffffff;
    border-radius: 10rpx;
  }

  .arrow {
    font-size: 24rpx;
    color: #999999;
  }

  .actions {
    padding: 0 30rpx;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .btn {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    font-size: 28rpx;
    border-radius: 10rpx;
    margin-left: 0 !important;
    background-color: #ffffff;
    color: #333333;
  }

  .btn-primary {
    background-color: #007aff;
    color: #ffffff;
  }

  .btn-primary[disabled] {
    background-color: #99ccff;
  }

  .btn[disabled] {
    background-color: #f5f5f5;
    color: #cccccc;
  }

  .log {
    margin: 30rpx;
    padding: 20rpx;
    background-color: #1a1a1a;
    border-radius: 10rpx;
  }

  .log-title {
    display: block;
    font-size: 28rpx;
    color: #ffffff;
    margin-bottom: 20rpx;
  }

  .log-content {
    height: 300rpx;
  }

  .log-content text {
    display: block;
    font-size: 24rpx;
    margin-bottom: 10rpx;
  }

  .log-info {
    color: #cccccc;
  }

  .log-warn {
    color: #ff9500;
  }

  .log-error {
    color: #ff3b30;
  }

  .log-success {
    color: #30d158;
  }

  .btn-clear {
    margin-top: 20rpx;
    font-size: 24rpx;
    color: #999999;
    background-color: transparent;
  }
</style>
```

## 权限配置

### Android

在 `AndroidManifest.xml` 中添加：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### iOS

无需额外权限配置，使用应用沙箱目录。

### 微信小程序

在 `app.json` 中添加：

```json
{
  "requiredPrivateInfos": ["chooseAddress"],
  "permission": {
    "scope.writePhotosAlbum": {
      "desc": "用于保存音频文件"
    }
  }
}
```

WebSocket 域名配置：登录[微信公众平台](https://mp.weixin.qq.com/)，在「开发」->「开发管理」->「开发设置」->「服务器域名」中添加：

```
wss://tts-api.xfyun.cn
```

### H5

无需额外权限配置。

## API

### synthesize(options)

开始语音合成。

| 参数       | 类型     | 必填 | 默认值    | 说明                         |
| ---------- | -------- | ---- | --------- | ---------------------------- |
| appId      | string   | 是   | -         | 讯飞应用 ID                  |
| apiKey     | string   | 是   | -         | 讯飞 API Key                 |
| apiSecret  | string   | 是   | -         | 讯飞 API Secret              |
| text       | string   | 是   | -         | 要合成的文本（少于2000字符） |
| voice      | string   | 否   | 'xiaoyan' | 发音人                       |
| speed      | number   | 否   | 50        | 语速（0-100）                |
| volume     | number   | 否   | 50        | 音量（0-100）                |
| pitch      | number   | 否   | 50        | 音调（0-100）                |
| onStart    | function | 否   | -         | 开始合成回调                 |
| onEnd      | function | 否   | -         | 播放结束回调                 |
| onError    | function | 否   | -         | 错误回调                     |
| onProgress | function | 否   | -         | 进度回调                     |

### stop()

停止播放并释放资源。

### 返回值

| 属性        | 类型               | 说明                 |
| ----------- | ------------------ | -------------------- |
| isPlaying   | Ref\<boolean>      | 是否正在播放         |
| isConnected | Ref\<boolean>      | WebSocket 是否已连接 |
| error       | Ref\<string\|null> | 错误信息             |
| synthesize  | Function           | 开始语音合成         |
| stop        | Function           | 停止播放             |

## 注意事项

1. 组件卸载时会自动调用 `stop()` 释放资源
2. Android/iOS 使用原生 API 播放，音频文件缓存到应用沙箱目录
3. 微信小程序播放结束后会自动删除临时文件
4. H5 平台使用 Blob URL 播放，播放结束后自动释放

## 版本要求

- **uni-app**: 3.0+
- **Vue**: 3.x

> 使用了 Vue 3 Composition API（`ref`, `onUnmounted`），不支持 uni-app 2.x。

## 许可证

MIT
