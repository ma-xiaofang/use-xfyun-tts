if (typeof uni === 'undefined') {
  throw new Error('[use-xfyun-tts] 此插件仅支持 uni-app 项目使用')
}
// #ifdef APP-PLUS
import { useXfyunTTSAndroid } from './useXfyunTTSAndroid.js'
import { useXfyunTTSIos } from './useXfyunTTSIos.js'
export default function useXfyunTTS() {
	const platform = uni.getSystemInfoSync().platform
	if (platform === 'ios') {
		return useXfyunTTSIos()
	}
	if (platform === 'android') {
		return useXfyunTTSAndroid()
	}
}
// #endif

// #ifdef H5
import { useXfyunTTSH5 } from './useXfyunTTSH5.js'
export default useXfyunTTSH5
// #endif

// #ifdef MP-WEIXIN
import { useXfyunTTSWx } from './useXfyunTTSWx.js'
export default useXfyunTTSWx
// #endif
