import CryptoJS from 'crypto-js'
import { ref, onUnmounted } from 'vue'

let innerAudioContext = null
let socketTask = null

function base64Encode(str) {
	return CryptoJS.enc.Utf8.parse(str).toString(CryptoJS.enc.Base64)
}

function getWebSocketUrl(apiKey, apiSecret) {
	const url = "wss://tts-api.xfyun.cn/v2/tts"
	const host = "tts-api.xfyun.cn"
	const date = new Date().toGMTString()
	const algorithm = "hmac-sha256"
	const headers = "host date request-line"
	
	const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`
	const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
	const signature = CryptoJS.enc.Base64.stringify(signatureSha)
	const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`
	const authorization = base64Encode(authorizationOrigin)
	
	return `${url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`
}

/**
 * 讯飞语音合成（TTS）Hook - 微信小程序平台实现
 */
export const useXfyunTTSWx = () => {
	const isPlaying = ref(false)
	const isConnected = ref(false)
	const error = ref(null)

	const synthesize = async (options) => {
		const { appId, apiKey, apiSecret, text, voice = 'xiaoyan', speed = 50, volume = 50, pitch = 50, onStart, onEnd, onError, onProgress } = options

		console.log('=== synthesize 被调用 ===')
		error.value = null
		const audioChunks = []

		try {
			const wsUrl = getWebSocketUrl(apiKey, apiSecret)
			console.log('WebSocket URL:', wsUrl)

			if (socketTask) { socketTask.close(); socketTask = null }

			socketTask = wx.connectSocket({
				url: wsUrl,
				success: () => console.log('wx.connectSocket success'),
				fail: (err) => { error.value = 'WebSocket 连接失败'; onError && onError('WebSocket 连接失败') }
			})

			socketTask.onOpen(() => {
				console.log('WebSocket OPEN')
				isConnected.value = true
				onStart && onStart()

				socketTask.send({
					data: JSON.stringify({
						common: { app_id: appId },
						business: { aue: 'lame', auf: 'audio/L16;rate=16000', sfl: 1, vcn: voice, speed, volume, pitch, bgs: 0, tte: 'UTF8' },
						data: { status: 2, text: base64Encode(text) }
					}),
					success: () => console.log('请求已发送'),
					fail: (err) => console.error('发送请求失败:', err)
				})
			})

			socketTask.onMessage((res) => {
				const data = JSON.parse(res.data)
				if (data.code !== 0) {
					error.value = `合成失败: ${data.message} (code: ${data.code})`
					onError && onError(error.value)
					socketTask.close()
					return
				}
				if (data.data?.audio) {
					audioChunks.push(data.data.audio)
					onProgress && onProgress({ status: data.data.status, audioSize: audioChunks.join('').length })
				}
				if (data.data?.status === 2) {
					socketTask.close()
					isConnected.value = false
					playAudio(audioChunks, onEnd, onError)
				}
			})

			socketTask.onError((e) => { error.value = 'WebSocket连接错误'; onError && onError('WebSocket连接错误'); isConnected.value = false })
			socketTask.onClose(() => { isConnected.value = false })

		} catch (e) {
			error.value = e.message
			onError && onError(e.message)
		}
	}

	const playAudio = (base64Chunks, onEnd, onError) => {
		if (!base64Chunks?.length) { onError && onError('没有音频数据'); return }

		try {
			const fs = wx.getFileSystemManager()
			const filePath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.mp3`

			const arrayBuffers = base64Chunks.map((chunk) => wx.base64ToArrayBuffer(chunk))
			const totalLength = arrayBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
			const mergedBuffer = new Uint8Array(totalLength)
			let offset = 0
			for (const buf of arrayBuffers) {
				mergedBuffer.set(new Uint8Array(buf), offset)
				offset += buf.byteLength
			}

			fs.writeFile({
				filePath: filePath,
				data: mergedBuffer.buffer,
				encoding: 'binary',
				success: () => {
					if (innerAudioContext) { innerAudioContext.stop(); innerAudioContext.destroy(); innerAudioContext = null }

					innerAudioContext = wx.createInnerAudioContext()
					innerAudioContext.src = filePath

					innerAudioContext.onPlay(() => { console.log('开始播放'); isPlaying.value = true })
					innerAudioContext.onEnded(() => {
						isPlaying.value = false
						if (innerAudioContext) { innerAudioContext.destroy(); innerAudioContext = null }
						fs.unlink({ filePath: filePath, success: () => console.log('临时文件已删除'), fail: () => {} })
						onEnd && onEnd()
					})
					innerAudioContext.onError((e) => {
						isPlaying.value = false
						if (innerAudioContext) { innerAudioContext.destroy(); innerAudioContext = null }
						fs.unlink({ filePath: filePath, fail: () => {} })
						onError && onError('播放失败')
					})

					innerAudioContext.play()
				},
				fail: (e) => { console.error('文件写入失败:', e); onError && onError('文件写入失败') }
			})
		} catch (e) {
			onError && onError(e.message)
		}
	}

	const stop = () => {
		if (innerAudioContext) { innerAudioContext.stop(); innerAudioContext.destroy(); innerAudioContext = null }
		if (socketTask) { socketTask.close(); socketTask = null }
		isPlaying.value = false
		isConnected.value = false
	}

	onUnmounted(stop)

	return { isPlaying, isConnected, error, synthesize, stop }
}
