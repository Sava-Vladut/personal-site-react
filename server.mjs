import { createServer } from 'node:http'
import { mkdir, readFile, stat, appendFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'dist')
const indexPath = join(distDir, 'index.html')
const onlineLogPath = process.env.ONLINE_LOG_PATH || join(__dirname, 'data', 'online.csv')
const port = Number(process.env.PORT || 4173)
const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

const readRequestJson = (request) => new Promise((resolve, reject) => {
  let body = ''

  request.on('data', (chunk) => {
    body += chunk
    if (body.length > 10_000) {
      reject(new Error('Request body is too large.'))
      request.destroy()
    }
  })

  request.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {})
    } catch {
      reject(new Error('Request body must be valid JSON.'))
    }
  })

  request.on('error', reject)
})

const handleOnlineLog = async (request, response) => {
  if (request.method === 'GET') {
    try {
      const contents = await readFile(onlineLogPath, 'utf8').catch((error) => {
        if (error && error.code === 'ENOENT') return ''
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

      const contents = await readFile(onlineLogPath, 'utf8').catch((error) => {
        if (error && error.code === 'ENOENT') return ''
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
}

const getStaticPath = (pathname) => {
  const decodedPath = decodeURIComponent(pathname)
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = normalizedPath === '/' ? indexPath : join(distDir, normalizedPath)

  if (!filePath.startsWith(distDir)) {
    return null
  }

  return filePath
}

const serveStatic = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const filePath = getStaticPath(url.pathname)

  if (!filePath) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const fileStat = await stat(filePath)
    const resolvedPath = fileStat.isDirectory() ? join(filePath, 'index.html') : filePath
    const contents = await readFile(resolvedPath)
    const contentType = contentTypes.get(extname(resolvedPath)) || 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': contentType })
    response.end(contents)
  } catch {
    const contents = await readFile(indexPath)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(contents)
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (url.pathname === '/api/online') {
    void handleOnlineLog(request, response)
    return
  }

  void serveStatic(request, response)
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
  console.log(`Online CSV log: ${onlineLogPath}`)
})
