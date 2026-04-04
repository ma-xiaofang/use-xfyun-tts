import CryptoJS from 'crypto-js'
import { Base64 } from "js-base64";
import { ref, onUnmounted } from 'vue'

let audioChunks = []
let currentAudio = null
let currentWebSocket = null

function getWebSocketUrl(apiKey, apiSecret) {
  const url = "wss://tts-api.xfyun.cn/v2/tts";
  const host = "tts-api.xfyun.cn";
  const date = new Date().toGMTString();
  const algorithm = "hmac-sha256";
  const headers = "host date request-line";
  
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  
  const wsUrl = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
  return wsUrl;
}

/**
 * 讯飞语音合成（TTS）Hook - H5 平台实现
 */
export const useXfyunTTSH5 = () => {
	const isPlaying = ref(false)
	const isConnected = ref(false)
	const error = ref(null)

	const synthesize = async (options) => {
		const { appId, apiKey, apiSecret, text, voice, speed = 50, volume = 50, pitch = 50, onStart, onEnd, onError, onProgress } = options
		
		error.value = null
		isPlaying.value = true
		audioChunks = []

		try {
			const wsUrl = getWebSocketUrl(apiKey, apiSecret)
			if (currentWebSocket) { currentWebSocket.close(); currentWebSocket = null }
			currentWebSocket = new WebSocket(wsUrl)
			
			currentWebSocket.onopen = () => {
				console.log('WebSocket OPEN')
				isConnected.value = true
				onStart && onStart()
				
				currentWebSocket.send(JSON.stringify({
					common: { app_id: appId },
					business: { aue: 'lame', auf: 'audio/L16;rate=16000', sfl: 1, vcn: voice, speed, volume, pitch, bgs: 0, tte: 'UTF8' },
					data: { status: 2, text: Base64.encode(text) }
				}))
			}
			
			currentWebSocket.onmessage = (event) => {
				let data = JSON.parse(event.data)
				
				if (data.code !== 0) {
					error.value = `合成失败: ${data.message} (code: ${data.code})`
					isPlaying.value = false
					onError && onError(error.value)
					currentWebSocket.close()
					return
				}
				
				if (data.data?.audio) {
					audioChunks.push(data.data.audio)
					onProgress && onProgress({ status: data.data.status, audioSize: audioChunks.join('').length })
				}
				
				if (data.data?.status === 2) {
					currentWebSocket.close()
					isConnected.value = false
					playAudio(audioChunks, onEnd, onError)
				}
			}
			
			currentWebSocket.onerror = () => { error.value = 'WebSocket连接错误'; isPlaying.value = false; onError && onError('WebSocket连接错误') }
			currentWebSocket.onclose = () => { isConnected.value = false }
		} catch (e) {
			error.value = e.message
			isPlaying.value = false
			onError && onError(e.message)
		}
	}

	const playAudio = (base64Chunks, onEnd, onError) => {
		try {
			if (currentAudio) { currentAudio.pause(); currentAudio = null }
			
			const allData = base64Chunks.map((chunk) => atob(chunk))
			const binaryString = allData.join('')
			const len = binaryString.length
			const bytes = new Uint8Array(len)
			for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
			 
			const blob = new Blob([bytes], { type: 'audio/mp3' })
			const url = URL.createObjectURL(blob)
			currentAudio = new Audio(url)
			
			currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; isPlaying.value = false; onEnd && onEnd() }
			currentAudio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; isPlaying.value = false; onError && onError('音频播放失败') }
			
			isPlaying.value = true
			currentAudio.play()
		} catch (e) {
			isPlaying.value = false
			onError && onError(e.message)
		}
	}
	
	const stop = () => {
		if (currentAudio) { currentAudio.pause(); currentAudio = null }
		if (currentWebSocket) { currentWebSocket.close(); currentWebSocket = null }
		isPlaying.value = false
		isConnected.value = false
	}

	onUnmounted(stop)
	
	return { isPlaying, isConnected, error, synthesize, stop }
}
