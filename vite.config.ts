import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { createOnlineLogHandler } from './onlineLogApi.mjs'

const onlineLogPath = process.env.ONLINE_LOG_PATH || join(process.cwd(), 'data', 'online.csv')
const onlineLogToken = process.env.ONLINE_LOG_TOKEN || ''

const onlineLogDevPlugin = (): Plugin => ({
  name: 'online-log-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/online', createOnlineLogHandler({ onlineLogPath, onlineLogToken }))
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), onlineLogDevPlugin()],
  assetsInclude: ['**/*.rar'],
})
