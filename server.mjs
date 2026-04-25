import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOnlineLogHandler } from './onlineLogApi.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'dist')
const indexPath = join(distDir, 'index.html')
const onlineLogPath = process.env.ONLINE_LOG_PATH || join(__dirname, 'data', 'online.csv')
const onlineLogToken = process.env.ONLINE_LOG_TOKEN || ''
const port = Number(process.env.PORT || 4173)
const handleOnlineLog = createOnlineLogHandler({ onlineLogPath, onlineLogToken })

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

const getStaticPath = (pathname) => {
  const decodedPath = decodeURIComponent(pathname)
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = normalizedPath === '/' ? indexPath : join(distDir, normalizedPath)

  const relativePath = relative(distDir, filePath)
  if (relativePath.startsWith('..') || relativePath === '..') {
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
