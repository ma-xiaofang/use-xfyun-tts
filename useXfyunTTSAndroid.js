import CryptoJS from 'crypto-js'
import { ref, onUnmounted } from 'vue'

/**
 * MediaPlayer 实例
 * @type {Object|null}
 */
let mediaPlayer = null

/**
 * SocketTask 实例
 * @type {Object|null}
 */
let socketTask = null

/**
 * Base64 编码字符串
 */
function base64Encode(str) {
	return CryptoJS.enc.Utf8.parse(str).toString(CryptoJS.enc.Base64)
}

/**
 * 生成符合 RFC1123 规范的日期字符串
 */
function getRFC1123Date() {
	const now = new Date()
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	return `${days[now.getUTCDay()]}, ${String(now.getUTCDate()).padStart(2, '0')} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} GMT`
}

/**
 * 生成讯飞 TTS WebSocket 连接 URL
 */
function getWebSocketUrl(apiKey, apiSecret) {
	const url = "wss://tts-api.xfyun.cn/v2/tts"
	const host = "tts-api.xfyun.cn"
	const date = getRFC1123Date()
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
 * 讯飞语音合成（TTS）Hook - Android 平台实现
 */
export const useXfyunTTSAndroid = () => {
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

			socketTask = uni.connectSocket({
				url: wsUrl,
				success: () => console.log('uni.connectSocket success'),
				fail: (err) => { error.value = 'WebSocket 连接失败'; onError && onError('WebSocket 连接失败') }
			})

			socketTask.onOpen(() => {
				console.log('WebSocket OPEN')
				isConnected.value = true
				onStart && onStart()

				socketTask.send({
					data: JSON.stringify({
						common: { app_id: appId },
						business: { aue: 'lame', sfl: 1, vcn: voice, speed, volume, pitch, bgs: 0, tte: 'UTF8' },
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
					playAudio(audioChunks, text, onEnd, onError)
				}
			})

			socketTask.onError((e) => { error.value = 'WebSocket连接错误'; onError && onError('WebSocket连接错误'); isConnected.value = false })
			socketTask.onClose(() => { isConnected.value = false })

		} catch (e) {
			error.value = e.message
			onError && onError(e.message)
		}
	}

	const playAudio = (base64Chunks, text, onEnd, onError) => {
		if (!base64Chunks?.length) { onError && onError('没有音频数据'); return }

		try {
			const Base64 = plus.android.importClass('android.util.Base64')
			const File = plus.android.importClass('java.io.File')
			const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
			const ByteArrayOutputStream = plus.android.importClass('java.io.ByteArrayOutputStream')
			
			const baos = new ByteArrayOutputStream()
			for (const chunk of base64Chunks) baos.write(Base64.decode(chunk, Base64.DEFAULT))
			
			const context = plus.android.runtimeMainActivity()
			const Environment = plus.android.importClass('android.os.Environment')
			const externalFilesDir = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
			const fileName = CryptoJS.MD5(text).toString() + '.mp3'
			const tempFile = new File(externalFilesDir, fileName)
			const filePath = tempFile.getAbsolutePath()
			console.log('文件路径:', filePath)
			
			const fos = new FileOutputStream(tempFile)
			baos.writeTo(fos)
			fos.close()
			baos.close()

			if (mediaPlayer) { try { mediaPlayer.stop(); mediaPlayer.release() } catch (e) {} mediaPlayer = null }

			const MediaPlayer = plus.android.importClass('android.media.MediaPlayer')
			mediaPlayer = new MediaPlayer()
			mediaPlayer.setDataSource(filePath)
			mediaPlayer.prepare()
			mediaPlayer.start()
			isPlaying.value = true

			mediaPlayer.setOnCompletionListener(plus.android.implements('android.media.MediaPlayer$OnCompletionListener', {
				onCompletion: (mp) => { mp.release(); mediaPlayer = null; isPlaying.value = false; onEnd && onEnd() }
			}))

			mediaPlayer.setOnErrorListener(plus.android.implements('android.media.MediaPlayer$OnErrorListener', {
				onError: (mp) => { mp.release(); mediaPlayer = null; isPlaying.value = false; onError && onError('播放失败'); return true }
			}))

		} catch (e) { isPlaying.value = false; onError && onError(e.message || '播放失败') }
	}

	const stop = () => {
		if (mediaPlayer) { try { mediaPlayer.stop(); mediaPlayer.release() } catch (e) {} mediaPlayer = null }
		if (socketTask) { socketTask.close(); socketTask = null }
		isPlaying.value = false
		isConnected.value = false
	}

	onUnmounted(stop)

	return { isPlaying, isConnected, error, synthesize, stop }
}
