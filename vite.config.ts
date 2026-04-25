import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { logAllUsers, readLogRows, readTrackerState, readUsers, csvPath as instagramCsvPath, usersPath as instagramUsersPath } from './server/instagram-tracker.mjs'

const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const onlineLogPath = process.env.ONLINE_LOG_PATH || join(process.cwd(), 'data', 'online.csv')

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown) => {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const readRequestJson = (request: IncomingMessage) => new Promise<Record<string, unknown>>((resolve, reject) => {
  let body = ''

  request.on('data', (chunk: Buffer) => {
    body += chunk
    if (body.length > 10_000) {
      reject(new Error('Request body is too large.'))
      request.destroy()
    }
  })

  request.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) as Record<string, unknown> : {})
    } catch {
      reject(new Error('Request body must be valid JSON.'))
    }
  })

  request.on('error', reject)
})

const onlineLogDevPlugin = (): Plugin => ({
  name: 'online-log-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/online', async (request, response) => {
      if (request.method === 'GET') {
        try {
          const contents = await readFile(onlineLogPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return ''
            throw error
          })
          const rows = contents
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
          sendJson(response, 200, { ok: true, rows })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to read online log.'
          sendJson(response, 500, { ok: false, error: message })
        }
        return
      }

      if (request.method === 'DELETE') {
        try {
          const body = await readRequestJson(request)
          const index = Number(body.index)

          if (!Number.isSafeInteger(index) || index < 1) {
            sendJson(response, 400, { ok: false, error: 'Index must be a positive number.' })
            return
          }

          const contents = await readFile(onlineLogPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return ''
            throw error
          })
          const rows = contents
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)

          if (index > rows.length) {
            sendJson(response, 404, { ok: false, error: `No online log entry found at index ${index}.` })
            return
          }

          const [removed] = rows.splice(index - 1, 1)
          await mkdir(dirname(onlineLogPath), { recursive: true })
          await writeFile(onlineLogPath, rows.length > 0 ? `${rows.join('\n')}\n` : '', 'utf8')
          sendJson(response, 200, { ok: true, removed })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to remove online log entry.'
          sendJson(response, 500, { ok: false, error: message })
        }
        return
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'Method not allowed.' })
        return
      }

      try {
        const body = await readRequestJson(request)
        const timestamp = typeof body.timestamp === 'string' ? body.timestamp : ''

        if (!timestampPattern.test(timestamp)) {
          sendJson(response, 400, { ok: false, error: 'Timestamp must use YYYY-MM-DD HH:mm:ss.' })
          return
        }

        await mkdir(dirname(onlineLogPath), { recursive: true })
        await appendFile(onlineLogPath, `${timestamp}\n`, 'utf8')
        sendJson(response, 200, { ok: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to write online log.'
        sendJson(response, 500, { ok: false, error: message })
      }
    })
  },
})

const instagramTrackerDevPlugin = (): Plugin => ({
  name: 'instagram-tracker-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/instagram', async (request, response) => {
      if (request.method === 'GET') {
        try {
          const [users, rows, state] = await Promise.all([readUsers(), readLogRows(), readTrackerState()])
          sendJson(response, 200, { ok: true, users, rows, state, csvPath: instagramCsvPath, usersPath: instagramUsersPath })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to read Instagram tracker data.'
          sendJson(response, 500, { ok: false, error: message })
        }
        return
      }

      if (request.method === 'POST') {
        try {
          await logAllUsers()
          const [users, rows, state] = await Promise.all([readUsers(), readLogRows(), readTrackerState()])
          sendJson(response, 200, { ok: true, users, rows, state, csvPath: instagramCsvPath, usersPath: instagramUsersPath })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to refresh Instagram counts.'
          sendJson(response, 500, { ok: false, error: message })
        }
        return
      }

      sendJson(response, 405, { ok: false, error: 'Method not allowed.' })
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), onlineLogDevPlugin(), instagramTrackerDevPlugin()],
  assetsInclude: ['**/*.rar'],
})
