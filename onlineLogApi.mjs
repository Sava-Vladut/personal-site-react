import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const mutatingMethods = new Set(['DELETE', 'POST'])

const sendJson = (response, statusCode, payload) => {
  if (typeof response.writeHead === 'function') {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  } else {
    response.statusCode = statusCode
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
  }
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

const readRows = async (onlineLogPath) => {
  const contents = await readFile(onlineLogPath, 'utf8').catch((error) => {
    if (error && error.code === 'ENOENT') return ''
    throw error
  })

  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const getBearerToken = (request) => {
  const authorization = request.headers.authorization
  if (!authorization || typeof authorization !== 'string') return ''

  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() ?? ''
}

const isAuthorized = (request, onlineLogToken) => (
  Boolean(onlineLogToken) && getBearerToken(request) === onlineLogToken
)

const rejectUnauthorizedMutation = (request, response, onlineLogToken) => {
  if (!mutatingMethods.has(request.method ?? '')) return false

  if (!onlineLogToken) {
    sendJson(response, 503, { ok: false, error: 'Online log mutations are not configured.' })
    return true
  }

  if (!isAuthorized(request, onlineLogToken)) {
    sendJson(response, 401, { ok: false, error: 'Online log token is missing or invalid.' })
    return true
  }

  return false
}

export const createOnlineLogHandler = ({ onlineLogPath, onlineLogToken = '' }) => async (request, response) => {
  if (request.method === 'GET') {
    try {
      sendJson(response, 200, { ok: true, rows: await readRows(onlineLogPath) })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read online log.'
      sendJson(response, 500, { ok: false, error: message })
    }
    return
  }

  if (rejectUnauthorizedMutation(request, response, onlineLogToken)) {
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

      const rows = await readRows(onlineLogPath)
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
