<template>
  <div class="player-container">
    <div class="connection-status" :class="connectionState">
      {{ statusText }}
    </div>

    <video ref="videoPlayer" controls class="video-element" src="http://localhost:8080/videos/0e96e154-f0e7-4cf2-9878-b4b3288c9ffa.mp4" @timeupdate="onTimeUpdate"></video>
    <canvas ref="canvas" class="danmaku-canvas"></canvas>
    <div class="danmaku-input">
      <input v-model="message" @keyup.enter="sendDanmaku" />
      <button @click="sendDanmaku">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Client } from '@stomp/stompjs'

// 连接状态
const connectionState = ref<'connected' | 'connecting' | 'disconnected'>('connecting')
const retryCount = ref(0) // 重试计数器

// 计算状态文本
const statusText = computed(() => {
  return {
    connected: '弹幕连接正常 🟢',
    connecting: `连接中${'.'.repeat(retryCount.value % 4)} 🔄`,
    disconnected: '弹幕连接断开 🔴'
  }[connectionState.value]
})

const videoPlayer = ref<HTMLVideoElement>()
const canvas = ref<HTMLCanvasElement>()
const message = ref('')
const videoId = '16' // 实际应从路由获取

// 存储弹幕
let stompClient: Client
let ctx: CanvasRenderingContext2D
const danmakus: { text: string, x: number, y: number, speed: number, startTime: number }[] = []

// 当前时间点的弹幕列表
const currentDanmakus = ref<{ text: string, x: number, y: number, speed: number }[]>([])

onMounted(() => {
  initCanvas()
  connectWebSocket()
  loadHistory()
  requestAnimationFrame(drawDanmaku)
})

function initCanvas() {
  const canvasElem = canvas.value!
  ctx = canvasElem.getContext('2d')!

  const resizeObserver = new ResizeObserver(() => {
    canvasElem.width = canvasElem.offsetWidth
    canvasElem.height = canvasElem.offsetHeight
  })
  resizeObserver.observe(canvasElem)
}

async function loadHistory() {
  const currentTime = videoPlayer.value?.currentTime || 0
  const response = await fetch(`http://localhost:8080/danmaku/history?videoId=${videoId}&currentTime=${currentTime}`)
  const data = await response.json()
  data.forEach((d: any) => addDanmaku(d.content, d.color, d.time))
}

// 连接 WebSocket
function connectWebSocket() {
  connectionState.value = 'connecting'

  // 使用原生 WebSocket 进行连接
  const socket = new WebSocket('ws://localhost:8080/ws') // 直接连接到后端 WebSocket 端点

  socket.onopen = () => {
    connectionState.value = 'connected'
    retryCount.value = 0
    console.log('WebSocket 连接成功')
  }

  socket.onclose = (event) => {
    connectionState.value = 'disconnected'
    console.log('WebSocket 连接关闭，代码:', event.code)
  }

  socket.onerror = (error) => {
    connectionState.value = 'disconnected'
    console.log('WebSocket 错误', error)
  }

  // 使用 STOMP 协议进行通信
  stompClient = new Client({
    brokerURL: 'ws://localhost:8080/ws', // 通过 WebSocket 连接
    onConnect: () => {
      stompClient.subscribe(`/topic/video/${videoId}`, (message) => {
        const danmaku = JSON.parse(message.body)
        addDanmaku(danmaku.content, danmaku.color, danmaku.time)
      })
    },
    onDisconnect: () => {
      connectionState.value = 'disconnected'
      console.log('连接已断开，尝试重连中...')
    },
    onStompError: (frame) => {
      connectionState.value = 'disconnected'
      console.error('STOMP协议错误:', frame.headers.message)
    },
    onWebSocketClose: (event) => {
      connectionState.value = 'disconnected'
      console.log('WebSocket关闭代码:', event.code)
    }
  })
  stompClient.activate()
}

// 将弹幕添加到列表中，并记录对应的时间
function addDanmaku(text: string, color: string = '#fff', startTime: number) {
  const y = Math.random() * (canvas.value!.height - 20) + 20
  
  danmakus.push({
    text,
    x: canvas.value!.width,
    y,
    speed: 0.1,
    startTime,  // 设置弹幕的时间点
  })
}

// 根据当前视频时间更新要显示的弹幕
function onTimeUpdate() {
  const currentTime = videoPlayer.value?.currentTime || 0
  currentDanmakus.value = danmakus.filter(d => d.startTime <= currentTime && d.x >= 0)
  requestAnimationFrame(drawDanmaku)
}

// 绘制弹幕
function drawDanmaku() {
  ctx.clearRect(0, 0, canvas.value!.width, canvas.value!.height)

  // 绘制当前时间点需要显示的弹幕
  currentDanmakus.value.forEach((d, index) => {
    ctx.fillStyle = '#fff'
    ctx.font = '24px sans-serif'
    ctx.fillText(d.text, d.x, d.y)
    d.x -= d.speed
    
    // 如果弹幕已经完全移出屏幕，移除弹幕
    if (d.x < -ctx.measureText(d.text).width) {
      currentDanmakus.value.splice(index, 1)  // 从显示数组中删除
    }
  })

  requestAnimationFrame(drawDanmaku)
}

// 发送弹幕
async function sendDanmaku() {
  const danmaku = {
    videoId,
    content: message.value,
    color: '#ffffff',
    time: videoPlayer.value?.currentTime
  }

  stompClient.publish({
    destination: '/app/danmaku/send',
    body: JSON.stringify(danmaku)
  })

  message.value = ''
}

onUnmounted(() => {
  stompClient?.deactivate()
})
</script>

<style>

canvas{
  width: 1057px;
}
.player-container {
  position: relative;
  width: 800px;
  margin: 0 auto;
}

.danmaku-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.video-element {
  width: 100%;
  height: 450px;
}

.danmaku-input {
  margin-top: 20px;
}

/* 新增样式 */
.connection-status {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 5px 10px;
  border-radius: 4px;
  color: white;
  z-index: 100;
}

.connected {
  background-color: #67C23A;
}

.connecting {
  background-color: #E6A23C;
}

.disconnected {
  background-color: #F56C6C;
}
</style>
