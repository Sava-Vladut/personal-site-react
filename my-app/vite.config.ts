import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const onlineLogPath = path.resolve(__dirname, 'online-times.csv')
const onlineLogHeader = 'online_time_romania\n'

const readBody = async (request: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const ensureOnlineLog = async () => {
  try {
    await fs.access(onlineLogPath)
  } catch {
    await fs.writeFile(onlineLogPath, onlineLogHeader, 'utf8')
  }
}

const onlineLogPlugin = (): Plugin => ({
  name: 'online-log-api',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/online-log', async (request: IncomingMessage, response: ServerResponse) => {
      await ensureOnlineLog()
      response.setHeader('Content-Type', 'application/json')

      if (request.method === 'GET') {
        const csv = await fs.readFile(onlineLogPath, 'utf8')
        response.end(JSON.stringify({ csv }))
        return
      }

      if (request.method === 'POST') {
        const body = JSON.parse(await readBody(request)) as {
          onlineTimeRomania?: string
        }
        if (!body.onlineTimeRomania) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'Missing online time.' }))
          return
        }
        const row = `"${body.onlineTimeRomania.replaceAll('"', '""')}"\n`
        await fs.appendFile(onlineLogPath, row, 'utf8')
        const csv = await fs.readFile(onlineLogPath, 'utf8')
        response.end(JSON.stringify({ csv }))
        return
      }

      if (request.method === 'PUT') {
        const body = JSON.parse(await readBody(request)) as {
          entries?: { onlineTimeRomania?: string }[]
        }
        if (!Array.isArray(body.entries)) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'Missing entries.' }))
          return
        }
        const rows = body.entries
          .filter((entry) => entry.onlineTimeRomania)
          .map((entry) => `"${entry.onlineTimeRomania!.replaceAll('"', '""')}"`)
        const csv = `${onlineLogHeader}${rows.join('\n')}${rows.length > 0 ? '\n' : ''}`
        await fs.writeFile(onlineLogPath, csv, 'utf8')
        response.end(JSON.stringify({ csv }))
        return
      }

      response.statusCode = 405
      response.end(JSON.stringify({ error: 'Method not allowed.' }))
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), onlineLogPlugin()],
  assetsInclude: ['**/*.rar'],
})
