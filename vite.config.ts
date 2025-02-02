import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ], 
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true, // 允许 WebSocket
        changeOrigin: true,
        secure: false // 如果后端是 HTTP 而不是 HTTPS
      },
      "/api":{
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  },
  // resolve: {
   
  //   alias: {
  //     '@': fileURLToPath(new URL('./src', import.meta.url))
  //   },
  // },

  define: {
    global: {}
  }
})


